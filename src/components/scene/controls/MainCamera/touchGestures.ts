/**
 * Walking the room with one finger, on phones and tablets (AR-172).
 *
 * Slide the way you want to go: up walks forward, down steps back, left and
 * right turn. That is the laptop's own scheme (the mouse drag turns toward the
 * side it moves to), so a visitor who has used both meets one set of rules.
 *
 * A slide is a walk OR a turn, never both. Whichever way the finger first
 * travels decides, and that holds until it lifts: a finger never moves
 * perfectly straight, and a slightly diagonal slide that walked and turned at
 * once would weave like a drunk.
 *
 * Only a single finger that lands on the room itself moves the camera — never
 * one on a button, a panel or a dialog over it — and a second finger ends the
 * slide, so a stray pinch does nothing.
 */

/** How far the finger travels before the slide is read as a walk or a turn. */
const AXIS_LOCK_PX = 10

/**
 * Meters walked per pixel slid. A comfortable slide on a phone held sideways
 * (~200px) is two meters; on a tablet a longer one goes further.
 */
const WALK_PER_PX = 0.01

/**
 * Turn per pixel slid, in the units of the mouse drag (`MouseState.deltaX`),
 * so a slide turns with the same feel and momentum as a drag. A mouse drag
 * settles at 0.005 rad per pixel, so this is 0.004 rad: a slide across a phone
 * held sideways turns a little over half a circle.
 */
const TURN_PER_PX = 0.8

/**
 * Up walks forward and right turns right. Flip either sign to try the other
 * convention (the "drag the room" one panorama viewers use).
 */
const WALK_SIGN = -1 // screen y grows downward, and up is forward
const TURN_SIGN = 1

/**
 * After the finger lifts, the walk carries on a moment and eases out, like a
 * page flicked on a phone. The share of the speed kept per 60fps frame.
 */
export const TOUCH_GLIDE_DECAY = 0.9

export type TouchGesture = {
  /** One finger is down on the room. */
  active: boolean
  axis: 'walk' | 'turn' | null
  startX: number
  startY: number
  lastX: number
  lastY: number
}

export const createTouchGesture = (): TouchGesture => ({
  active: false,
  axis: null,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
})

const end = (gesture: TouchGesture) => {
  gesture.active = false
  gesture.axis = null
}

/** Starts a slide; true when one began. */
export const beginTouch = (gesture: TouchGesture, event: TouchEvent): boolean => {
  const touch = event.touches[0]
  // The room is the canvas: anything else under the finger is the page's own
  // UI (buttons, the artwork panel, dialogs), and scrolls or taps as usual.
  if (event.touches.length !== 1 || !touch || !(event.target instanceof HTMLCanvasElement)) {
    end(gesture)
    return false
  }
  gesture.active = true
  gesture.axis = null
  gesture.startX = gesture.lastX = touch.clientX
  gesture.startY = gesture.lastY = touch.clientY
  return true
}

/** One move of the finger: how far to walk (meters, + is forward) and turn (mouse units). */
export const moveTouch = (
  gesture: TouchGesture,
  event: TouchEvent,
): { walk: number; turn: number } => {
  const still = { walk: 0, turn: 0 }
  const touch = event.touches[0]
  if (!gesture.active || event.touches.length !== 1 || !touch) return still

  const x = touch.clientX
  const y = touch.clientY

  if (!gesture.axis) {
    const dx = x - gesture.startX
    const dy = y - gesture.startY
    if (Math.hypot(dx, dy) < AXIS_LOCK_PX) return still
    gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'turn' : 'walk'
    // lastX/lastY still hold the start, so the travel that decided the axis
    // counts too: no dead patch at the beginning of every slide.
  }

  const dx = x - gesture.lastX
  const dy = y - gesture.lastY
  gesture.lastX = x
  gesture.lastY = y

  return gesture.axis === 'walk'
    ? { walk: dy * WALK_PER_PX * WALK_SIGN, turn: 0 }
    : { walk: 0, turn: dx * TURN_PER_PX * TURN_SIGN }
}

/** A finger lifted (or the browser took the touch away). The slide ends with the last finger. */
export const endTouch = (gesture: TouchGesture, event: TouchEvent) => {
  if (event.touches.length === 0) end(gesture)
}
