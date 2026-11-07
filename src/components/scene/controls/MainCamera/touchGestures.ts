/**
 * Fingers on the room, on phones and tablets (see `navigation` for the model they drive).
 *
 * One finger taps or drags. A tap (barely moving, quickly lifted) walks to where it landed, or
 * stands in front of the artwork there. A drag looks around and drags the room with it, the
 * convention of every photo, map and panorama on a phone: sliding right to left turns to the
 * right, sliding down tilts the head up. A drag turns and tilts at once, as the mouse's does
 * (AR-177, owner, 2026-11-05: "bring back the mixed vertical and horizontal axis rotate").
 *
 * Two fingers pinch to step forward or back: spreading them walks toward what is ahead, as if
 * drawing it closer. Two fingers that move together without pinching slide (`slideX`, `slideY`).
 *
 * In Artwork View, the owner's "Wall View" (MainCamera), the same moves mean other things: a finger's
 * drag and two fingers' slide both move over the wall, the work square on; a pinch leaves it.
 *
 * Only fingers that land on the room itself count — never one on a button, a panel or a dialog.
 */

import { PINCH_WALK_PER_PX, TAP_MAX_MOVE_PX, TAP_MAX_MS } from './navigation'

/**
 * How far two fingers travel (together, or apart) before they are read as a pinch or not: a pinch
 * rarely keeps its midpoint still, so the first few pixels are ambiguous.
 */
const TWO_FINGER_LOCK_PX = 12

export type TouchGesture = {
  /** `two`: two fingers down, not yet a pinch. `held`: two sliding together without pinching. */
  mode: 'none' | 'one' | 'two' | 'pinch' | 'held'
  /** One finger past a tap's slop: it is looking around, and can no longer be a tap. */
  looking: boolean
  /** One finger: where it landed and was last. Two: their midpoint. */
  startX: number
  startY: number
  lastX: number
  lastY: number
  /** When the first finger landed (ms). */
  startedAt: number
  /** A second finger came down since the first: whatever this is, it is not a tap. */
  several: boolean
  /** Two fingers' spread (px) when they landed, and when last read. */
  startSpread: number
  spread: number
}

export const createTouchGesture = (): TouchGesture => ({
  mode: 'none',
  looking: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  startedAt: 0,
  several: false,
  startSpread: 0,
  spread: 0,
})

/** The room is the canvas: anything else under a finger is the page's own UI. */
const onRoom = (touch: Touch | undefined): touch is Touch =>
  !!touch && touch.target instanceof HTMLCanvasElement

const spreadOf = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

const midpoint = (a: Touch, b: Touch) => ({
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2,
})

const end = (gesture: TouchGesture) => {
  gesture.mode = 'none'
  gesture.looking = false
}

/** A finger landed, at `now` (ms). */
export const beginTouch = (gesture: TouchGesture, event: TouchEvent, now: number) => {
  const [first, second] = [event.touches[0], event.touches[1]]

  if (event.touches.length === 1 && onRoom(first)) {
    gesture.mode = 'one'
    gesture.looking = false
    gesture.several = false
    gesture.startedAt = now
    gesture.startX = gesture.lastX = first.clientX
    gesture.startY = gesture.lastY = first.clientY
    return
  }

  if (event.touches.length > 1) gesture.several = true

  // The second finger ends a drag (whatever the first had done): a pinch, once the two have moved
  // far enough to tell (`moveTouch`).
  if (event.touches.length === 2 && onRoom(first) && onRoom(second)) {
    const middle = midpoint(first, second)
    gesture.mode = 'two'
    gesture.looking = false
    gesture.startX = gesture.lastX = middle.x
    gesture.startY = gesture.lastY = middle.y
    gesture.startSpread = gesture.spread = spreadOf(first, second)
    return
  }

  end(gesture)
}

export type TouchMove = {
  /** Meters to walk, + is forward (a pinch). */
  walk: number
  /**
   * The room grabbed and dragged (px), right and down positive: MainCamera turns it into the
   * angle that keeps the room under the finger, as it does for the mouse (AR-177, owner, 2026-11-05: a
   * slight slide turned the camera too much).
   */
  grabX: number
  grabY: number
  /** Two fingers sliding together without pinching (px, their midpoint), right and down positive. */
  slideX: number
  slideY: number
}

const STILL: TouchMove = { walk: 0, grabX: 0, grabY: 0, slideX: 0, slideY: 0 }

/** One move of the fingers. */
export const moveTouch = (gesture: TouchGesture, event: TouchEvent): TouchMove => {
  if (gesture.mode === 'two' || gesture.mode === 'pinch' || gesture.mode === 'held') {
    const [first, second] = [event.touches[0], event.touches[1]]
    if (!first || !second || gesture.startSpread <= 0) return STILL
    const spread = spreadOf(first, second)
    const middle = midpoint(first, second)

    if (gesture.mode === 'two') {
      const opened = Math.abs(spread - gesture.startSpread)
      const travelled = Math.hypot(middle.x - gesture.startX, middle.y - gesture.startY)
      if (Math.max(opened, travelled) < TWO_FINGER_LOCK_PX) return STILL
      // A pinch with one finger still moves its midpoint half as far as its spread opens; two
      // fingers sliding together move their midpoint and keep their spread. Either way, `spread`
      // and `lastX`/`lastY` still hold the start, so the stretch that decided counts too.
      gesture.mode = opened > travelled ? 'pinch' : 'held'
    }

    if (gesture.mode === 'held') {
      const slideX = middle.x - gesture.lastX
      const slideY = middle.y - gesture.lastY
      gesture.lastX = middle.x
      gesture.lastY = middle.y
      return { ...STILL, slideX, slideY }
    }

    const walk = (spread - gesture.spread) * PINCH_WALK_PER_PX
    gesture.spread = spread
    return { ...STILL, walk }
  }

  const touch = event.touches[0]
  if (gesture.mode !== 'one' || event.touches.length !== 1 || !touch) return STILL

  const x = touch.clientX
  const y = touch.clientY

  if (!gesture.looking) {
    if (Math.hypot(x - gesture.startX, y - gesture.startY) < TAP_MAX_MOVE_PX) return STILL
    // lastX/lastY still hold the start, so the travel past the slop counts too: no dead patch at
    // the beginning of every drag.
    gesture.looking = true
  }

  const dx = x - gesture.lastX
  const dy = y - gesture.lastY
  gesture.lastX = x
  gesture.lastY = y

  return { ...STILL, grabX: dx, grabY: dy }
}

/**
 * A finger lifted (or the browser took the touch away), at `now` (ms). Returns where a tap landed
 * (client px), or null when this was not one. Two fingers' gesture ends when either lifts, and the
 * one left on the glass does nothing until it lifts too.
 */
export const endTouch = (
  gesture: TouchGesture,
  event: TouchEvent,
  now: number,
): { x: number; y: number } | null => {
  const tap =
    gesture.mode === 'one' &&
    event.touches.length === 0 &&
    !gesture.looking &&
    !gesture.several &&
    now - gesture.startedAt <= TAP_MAX_MS &&
    event.type !== 'touchcancel'
      ? { x: gesture.startX, y: gesture.startY }
      : null
  if (event.touches.length === 0 || gesture.mode !== 'one') end(gesture)
  return tap
}

/** Whether one finger is dragging to look around (turning or tilting), not yet lifted. */
export const looking = (gesture: TouchGesture) => gesture.mode === 'one' && gesture.looking

/** Whether two fingers are sliding together without pinching (over the wall, in Wall View). */
export const sliding = (gesture: TouchGesture) => gesture.mode === 'held'

/** Whether two fingers are pinching (a step that eases out once they lift). */
export const pinching = (gesture: TouchGesture) => gesture.mode === 'pinch'
