/**
 * Walking the room with your fingers, on phones and tablets (AR-172).
 *
 * One finger drags the room: pull it toward you (slide down) to walk forward,
 * push it away (slide up) to step back, and slide it sideways to turn — the
 * room follows the finger, so sliding right to left turns to the right. That is
 * the convention of every photo, map and panorama on a phone (owner, after
 * trying it on his iPhone: the joystick way, up = forward, felt backwards).
 *
 * A slide is a walk OR a turn, never both. Whichever way the finger first
 * travels decides, and that holds until it lifts: a finger never moves
 * perfectly straight, and a slightly diagonal slide that walked and turned at
 * once would weave like a drunk.
 *
 * Two fingers pinch to zoom, as on any photo: spread them to look closer,
 * bring them together to come back. Or they slide together, left or right, and
 * the visitor steps aside without turning (AR-176): facing a work, the next
 * one along the wall is a step aside, not a turn, a walk and a turn back. Like
 * one finger, two drag the room: sliding them right brings the room right, so
 * the visitor steps left (owner, after trying it: the first version, right
 * steps right, was the wrong way round).
 *
 * Which of the two, the fingers' first travel decides, and it holds until one
 * lifts: their spread changing more than their midpoint moves is a pinch; their
 * midpoint moving sideways is a step. Moving up or down together does nothing.
 *
 * Only fingers that land on the room itself move the camera — never one on a
 * button, a panel or a dialog over it.
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
 * How far two fingers travel (together, or apart) before they are read as a
 * pinch or a step: a pinch rarely keeps its midpoint still, nor a two-finger
 * slide its spread, so the first few pixels of either are ambiguous.
 */
const TWO_FINGER_LOCK_PX = 12

/**
 * Meters stepped sideways per pixel two fingers slide: a third of a walk's. At a walk's rate a
 * slide across a phone held sideways (~300px) went 3 m, past the next work to the one after
 * (owner, 2026-11-05); now it is about a metre, one work along the wall.
 */
const STEP_PER_PX = WALK_PER_PX / 3

/** The room follows the finger: down walks forward, right to left turns right. */
const WALK_SIGN = 1 // screen y grows downward, and down is forward
const TURN_SIGN = -1 // the mouse turns right on a positive x; the finger on a negative one
const STEP_SIGN = -1 // two fingers drag the room, as one does: sliding right steps left

/** How far a pinch may zoom in (and never wider than the room's own lens). */
export const MAX_PINCH_ZOOM = 3

/**
 * After the finger lifts, the walk carries on a moment and eases out, like a
 * page flicked on a phone. The share of the speed kept per 60fps frame.
 */
export const TOUCH_GLIDE_DECAY = 0.9

/**
 * Two fingers' step eases out far sooner than a walk (AR-176): the visitor is lining up with a
 * work, so it stops close to where the fingers stopped. The share of the speed kept per frame.
 */
export const STEP_GLIDE_DECAY = 0.7

export type TouchGesture = {
  /**
   * `two`: two fingers down, not yet a pinch or a step. `held`: two fingers
   * that moved up or down together — nothing, until they lift.
   */
  mode: 'none' | 'slide' | 'two' | 'pinch' | 'step' | 'held'
  axis: 'walk' | 'turn' | null
  /** One finger: where it landed and was last. Two: their midpoint. */
  startX: number
  startY: number
  lastX: number
  lastY: number
  /** Two fingers' opening spread (px), and the zoom a pinch would begin from. */
  pinchFrom: number
  zoomFrom: number
}

export const createTouchGesture = (): TouchGesture => ({
  mode: 'none',
  axis: null,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  pinchFrom: 0,
  zoomFrom: 1,
})

/** The room is the canvas: anything else under a finger is the page's own UI. */
const onRoom = (touch: Touch | undefined): touch is Touch =>
  !!touch && touch.target instanceof HTMLCanvasElement

const spread = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

const midpoint = (a: Touch, b: Touch) => ({
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2,
})

const end = (gesture: TouchGesture) => {
  gesture.mode = 'none'
  gesture.axis = null
}

/** A finger landed. `zoom` is the camera's zoom now, where a pinch would start from. */
export const beginTouch = (gesture: TouchGesture, event: TouchEvent, zoom: number) => {
  const [first, second] = [event.touches[0], event.touches[1]]

  if (event.touches.length === 1 && onRoom(first)) {
    gesture.mode = 'slide'
    gesture.axis = null
    gesture.startX = gesture.lastX = first.clientX
    gesture.startY = gesture.lastY = first.clientY
    return
  }

  // The second finger ends a slide (whatever the first had done): a pinch or a
  // step, once the two have moved far enough to tell (`moveTouch`).
  if (event.touches.length === 2 && onRoom(first) && onRoom(second)) {
    const middle = midpoint(first, second)
    gesture.mode = 'two'
    gesture.axis = null
    gesture.startX = gesture.lastX = middle.x
    gesture.startY = gesture.lastY = middle.y
    gesture.pinchFrom = spread(first, second)
    gesture.zoomFrom = zoom
    return
  }

  end(gesture)
}

export type TouchMove = {
  /** Meters to walk, + is forward. */
  walk: number
  /** Meters to step sideways, + is to the right. */
  step: number
  /** Turn, in mouse units. */
  turn: number
  /** The zoom a pinch asks for, or null. */
  zoom: number | null
}

const STILL: TouchMove = { walk: 0, step: 0, turn: 0, zoom: null }

/** One move of the fingers: how far to walk, step and turn, or how far to zoom. */
export const moveTouch = (gesture: TouchGesture, event: TouchEvent): TouchMove => {
  if (gesture.mode === 'two' || gesture.mode === 'pinch' || gesture.mode === 'step') {
    const [first, second] = [event.touches[0], event.touches[1]]
    if (!first || !second || gesture.pinchFrom <= 0) return STILL
    const middle = midpoint(first, second)

    if (gesture.mode === 'two') {
      const opened = Math.abs(spread(first, second) - gesture.pinchFrom)
      const dx = middle.x - gesture.startX
      const dy = middle.y - gesture.startY
      const travelled = Math.hypot(dx, dy)
      if (Math.max(opened, travelled) < TWO_FINGER_LOCK_PX) return STILL
      // A pinch with one finger still moves its midpoint half as far as its
      // spread opens; a slide moves its midpoint and keeps its spread.
      gesture.mode = opened > travelled ? 'pinch' : Math.abs(dx) > Math.abs(dy) ? 'step' : 'held'
      // lastX still holds the start, so the travel that decided counts too.
    }

    if (gesture.mode === 'pinch')
      return { ...STILL, zoom: gesture.zoomFrom * (spread(first, second) / gesture.pinchFrom) }
    if (gesture.mode !== 'step') return STILL
    const dx = middle.x - gesture.lastX
    gesture.lastX = middle.x
    return { ...STILL, step: dx * STEP_PER_PX * STEP_SIGN }
  }

  const touch = event.touches[0]
  if (gesture.mode !== 'slide' || event.touches.length !== 1 || !touch) return STILL

  const x = touch.clientX
  const y = touch.clientY

  if (!gesture.axis) {
    const dx = x - gesture.startX
    const dy = y - gesture.startY
    if (Math.hypot(dx, dy) < AXIS_LOCK_PX) return STILL
    gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'turn' : 'walk'
    // lastX/lastY still hold the start, so the travel that decided the axis
    // counts too: no dead patch at the beginning of every slide.
  }

  const dx = x - gesture.lastX
  const dy = y - gesture.lastY
  gesture.lastX = x
  gesture.lastY = y

  return gesture.axis === 'walk'
    ? { ...STILL, walk: dy * WALK_PER_PX * WALK_SIGN }
    : { ...STILL, turn: dx * TURN_PER_PX * TURN_SIGN }
}

/**
 * A finger lifted (or the browser took the touch away). Two fingers' gesture
 * ends when either lifts, and the one left on the glass does nothing until it
 * lifts too — it would otherwise lurch the room the moment the pinch ended.
 */
export const endTouch = (gesture: TouchGesture, event: TouchEvent) => {
  if (event.touches.length === 0 || gesture.mode !== 'slide') end(gesture)
}

/** Whether fingers are on the room: walking, turning, stepping or pinching. */
export const touching = (gesture: TouchGesture) => gesture.mode !== 'none'
