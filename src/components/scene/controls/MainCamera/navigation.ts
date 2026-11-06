/**
 * How a visitor moves through the room: one model for fingers and the mouse, only the
 * input differs. The camera is a person's eye at a fixed height, so every move is a calm glide
 * along the floor, never a jump, never a flight.
 *
 * - A tap (or click) on the floor walks there; on a wall, to a step in front of it.
 * - A drag looks around: sideways turns, up and down tilts the head (only while standing still,
 *   and never more than `PITCH_LIMIT`). Any move levels the head again; a walk always follows
 *   the heading, never the tilt.
 * - A tap on an artwork stands in front of it, centered and level, the work framed by a shift of
 *   the lens (as an architect's shift lens does), not by raising the eye: Artwork View. Where to
 *   look next is the visitor's choice: nothing steps along the wall for them.
 * - Pinching steps forward or back (a person's eye does not zoom).
 *
 * Every tunable number is here. The pure math is here too, so it can be tested without WebGL.
 */

// ---------------------------------------------------------------------------
// Tap or drag

/** A finger that travels less than this (px) before it lifts is a tap; further, a drag. */
export const TAP_MAX_MOVE_PX = 10

/** The same for the mouse: a click barely moves. */
export const CLICK_MAX_MOVE_PX = 6

/** A tap or click lifts within this (ms). Held longer, it is not a tap. */
export const TAP_MAX_MS = 300

// ---------------------------------------------------------------------------
// Walking

/**
 * A tap on a wall: walk to a step in front of it (`'approach'`), or nothing (`'ignore'`).
 */
export const WALL_TAP: 'approach' | 'ignore' = 'approach'

/** How far in front of a tapped wall the walk ends (m), along the wall's normal. */
export const WALL_APPROACH_DISTANCE = 1

/**
 * The least distance any walk keeps from a wall (m). A hair beyond the collision rays' reach
 * (0.7 m), so a glide that ends here can always set off again in any direction.
 */
export const WALL_CLEARANCE = 0.75

/** A glide's pace (m/s): its length sets its duration, within the two bounds below. */
export const GLIDE_SPEED = 2.6
export const GLIDE_MIN_S = 0.4
export const GLIDE_MAX_S = 1.5

/** A glide to an artwork also turns to face it, so it is given a little longer. */
export const FOCUS_GLIDE_MIN_S = 0.7

/** A walk shorter than this (m) is not worth taking: the camera stays. */
export const MIN_WALK = 0.05

/** The floor's height in every space: the eye height is measured from it. */
export const FLOOR_Y = 0

/** Meters stepped per pixel two fingers spread (apart steps forward, together steps back). */
export const PINCH_WALK_PER_PX = 0.01

// ---------------------------------------------------------------------------
// Looking

/** How far the head tilts up or down, at most (radians): 10° (AR-177, owner, 2026-11-05: 20°, 15°, then 10°). */
export const PITCH_LIMIT = (10 * Math.PI) / 180

/** Share of the tilt given back per 60fps frame once the visitor moves: level in ~0.4 s. */
export const PITCH_LEVEL_RATE = 0.12

/**
 * How long the view takes to follow the hand (s, the time constant of an exponential ease). A
 * drag moves where the head is headed; the view eases there over time, not per input event: mouse
 * and touch events don't arrive in step with frames (two in one frame, none in the next), and a view
 * moved by each frame's share of them trembles.
 */
export const LOOK_SMOOTHING_S = 0.05

/**
 * A drag grabs the room, a finger's or the mouse's, as in Google Street View: a pixel dragged turns
 * (or tilts) the head by the angle a pixel spans at the middle of the screen. This share of it:
 * the room moves a little less than the hand, calmer than exactly under it (AR-177, owner, 2026-11-05:
 * 1 was "a little too sensitive", 0.8 too little; "a middle point").
 */
export const LOOK_GRAB_SCALE = 0.9

/**
 * A finger's turn, at the least: a slide across the whole screen turns this far (radians, 60°).
 * Upright, a phone sees only ~24° across (the lens is set by its height), so grabbing the room
 * there crawled — 19° for a whole slide (AR-177, owner, 2026-11-05: "too much now"). Sideways the grab
 * already turns more than this, and keeps it.
 */
export const MIN_TOUCH_SLIDE_TURN = (60 * Math.PI) / 180

/**
 * Let go of a drag while it moves and the view carries on, slowing as it goes, as in Google
 * Street View (AR-177, owner, 2026-11-05: "a little more" inertia). The time constant of its slowing (s):
 * it carries on about this many seconds' worth of the speed it was let go at.
 */
export const LOOK_INERTIA_S = 0.32

/** How the drag's speed is read (s, an ease over it), so a drag held still before letting go rests. */
export const LOOK_VELOCITY_SMOOTHING_S = 0.05

/** The fastest a let-go drag carries on turning (radians per second). */
export const MAX_LOOK_SPEED = 3

/** Slower than this (radians per second), a let-go drag has come to rest. */
export const LOOK_REST_SPEED = 0.02

/** The same ease for a pinch's step, a little longer, so a pinch also glides to a stop. */
export const PINCH_SMOOTHING_S = 0.12

// ---------------------------------------------------------------------------
// Artwork View

/** Where Artwork View stands relative to the work: close enough to fill the screen, with this margin. */
export const FOCUS_PADDING = 1.08

/** The closest Artwork View stands to a work (m): never nearer a wall than any walk. */
export const FOCUS_MIN_DISTANCE = WALL_CLEARANCE

/**
 * On a screen taller than wide, the farthest Artwork View steps back (m). Fitting a 3 m wall text
 * across an upright phone would want ~7.5 m, where no wall may stand behind. Beyond it the work's
 * sides are cropped: the eye does not widen.
 */
export const MAX_TALL_FOCUS_DISTANCE = 4

/**
 * On a phone in Artwork View, a slide that sets off within this slope of level (|dy| ≤ |dx| × it,
 * about 31°) walks along the wall instead of turning: facing a work, the next one is a step to the
 * side (AR-177, owner, 2026-11-05: "otherwise we have no way to see the next artwork"). Any other first move
 * looks around as usual and steps back from the work.
 */
export const SIDEWAYS_SLOPE = 0.6

/** The fastest a slide along the wall carries on once the finger lifts (m/s). */
export const MAX_PAN_SPEED = 3

/**
 * A swipe (one finger on a Magic Mouse, two on a trackpad) arrives as a stream of scroll events,
 * macOS's momentum included, which keeps coming long after the fingers stop. So a swipe's way
 * follows the scrolls as they come, not fixed by its first event: fixed, a turn's momentum
 * kept the next swipe forward a "turn", and the visitor could not walk (AR-177, owner, 2026-11-05: "if I
 * rotate, then I cannot go forward. If I go forward, then I cannot rotate").
 */

/** A pause this long (ms) ends one swipe; the next scroll starts afresh. */
export const SWIPE_GAP_MS = 200

/** A fresh swipe moves this far (px) before its way is decided: its first event alone is noise. */
export const SWIPE_DECIDE_PX = 6

/**
 * A swipe changes way after this many scrolls in a row clearly the other way (twice as far one way
 * as the other): ~50 ms, quick enough to lose nothing, slow enough that a wobble changes nothing.
 */
export const SWIPE_SWITCH_EVENTS = 3

export type Swipe = {
  /** The last scroll (ms). */
  at: number
  /** A fresh swipe, its way not yet decided: its scroll so far, held back (px). */
  deciding: boolean
  heldX: number
  heldY: number
  /** Sideways (turn, or walk along a wall) or up and down (walk). */
  sideways: boolean
  /** Scrolls in a row clearly the other way. */
  against: number
}

export const createSwipe = (): Swipe => ({
  at: Number.NEGATIVE_INFINITY,
  deciding: true,
  heldX: 0,
  heldY: 0,
  sideways: true,
  against: 0,
})

/**
 * What one scroll of a swipe asks: the room (or, `along`, the wall) dragged across `grabX` px, or a
 * walk of `walkY` px (+ is back, as the wheel's deltaY), and whether it steps back from a work.
 * Sideways in front of a work walks along the wall, as a phone's slide does; sideways elsewhere
 * turns; up or down walks forward or back (and leaves the work). With the Mac's natural scrolling,
 * fingers sliding right send a negative deltaX: the room is dragged right.
 */
export type SwipeMove = { grabX: number; along: boolean; walkY: number; leave: boolean }

const NO_SWIPE: SwipeMove = { grabX: 0, along: false, walkY: 0, leave: false }

export const readSwipe = (
  swipe: Swipe,
  deltaX: number,
  deltaY: number,
  now: number,
  artworkView: boolean,
): SwipeMove => {
  if (deltaX === 0 && deltaY === 0) return NO_SWIPE
  const gap = now - swipe.at
  swipe.at = now
  if (gap > SWIPE_GAP_MS) {
    swipe.deciding = true
    swipe.heldX = swipe.heldY = swipe.against = 0
  }

  let x = deltaX
  let y = deltaY
  if (swipe.deciding) {
    swipe.heldX += deltaX
    swipe.heldY += deltaY
    if (Math.abs(swipe.heldX) + Math.abs(swipe.heldY) < SWIPE_DECIDE_PX) return NO_SWIPE
    swipe.deciding = false
    swipe.sideways = Math.abs(swipe.heldX) >= Math.abs(swipe.heldY)
    x = swipe.heldX
    y = swipe.heldY
  } else {
    const otherWay = swipe.sideways
      ? Math.abs(deltaY) > Math.abs(deltaX) * 2
      : Math.abs(deltaX) > Math.abs(deltaY) * 2
    swipe.against = otherWay ? swipe.against + 1 : 0
    if (swipe.against >= SWIPE_SWITCH_EVENTS) {
      swipe.sideways = !swipe.sideways
      swipe.against = 0
    }
  }

  if (swipe.sideways) return { grabX: -x, along: artworkView, walkY: 0, leave: !artworkView }
  return { grabX: 0, along: false, walkY: y, leave: true }
}

/** Share of the lens shift given back per 60fps frame on leaving Artwork View: ~0.5 s. */
export const SHIFT_RELEASE_RATE = 0.1

// ---------------------------------------------------------------------------
// The floor ring

/**
 * Whether the floor shows its rings: where a tap walks to, and under the mouse where a click
 * would. Hidden for now (AR-177, owner, 2026-11-05: "a little annoying"; tapping anywhere walks, and the
 * entry hint says so). Kept, off, while he decides whether they go for good.
 */
export const SHOW_FLOOR_RINGS = false

/** The ring where a tap is walking to fades in this long (s). */
export const MARKER_FADE_S = 0.4

/** The entry hint stays at most this long (s) in view, unless the visitor walks first. */
export const HINT_MAX_S = 9

/**
 * How far ahead of the visitor the entry hint lies (m): at least this, and this much
 * beyond the nearest floor the eye sees (at 1.6 m with a 50° lens, ~3.4 m ahead).
 */
export const HINT_DISTANCE = 2.2
export const HINT_BEYOND = 1

// ---------------------------------------------------------------------------
// Math

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** Starts and ends at rest: a walk that sets off and arrives like a person. */
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/** Starts at speed and settles: a glide taken over from another already moving. */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/** How long a glide of `meters` takes (s). */
export const glideDuration = (meters: number, min = GLIDE_MIN_S) =>
  clamp(meters / GLIDE_SPEED, min, GLIDE_MAX_S)

/** An angle brought into (-π, π]: the short way round. */
export const wrapAngle = (angle: number) => {
  const turn = Math.PI * 2
  let a = angle % turn
  if (a <= -Math.PI) a += turn
  if (a > Math.PI) a -= turn
  return a
}

/**
 * The heading that looks along (dx, dz), for a camera turned by `rotation.set(pitch, yaw, 0,
 * 'YXZ')`: yaw 0 looks down −z.
 */
export const yawOf = (dx: number, dz: number) => Math.atan2(-dx, -dz)

/** The way a heading looks, along the floor. */
export const forwardOf = (yaw: number) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) })

/** The camera's right, along the floor, at a heading. */
export const rightOf = (yaw: number) => ({ x: Math.cos(yaw), z: -Math.sin(yaw) })

/** A lens shift, as the tangents of how far off the axis the view is moved, across and up. */
export type LensShift = { x: number; y: number }

export const NO_SHIFT: LensShift = { x: 0, y: 0 }

export const isShifted = (shift: LensShift) => Math.abs(shift.x) > 1e-5 || Math.abs(shift.y) > 1e-5

/**
 * The shift that puts `center` in the middle of the screen for an eye at `eye` facing `yaw` and
 * level: the work stays square on (its verticals vertical), only the view moves to it.
 */
export const lensShiftFor = (
  eye: { x: number; y: number; z: number },
  yaw: number,
  center: { x: number; y: number; z: number },
): LensShift => {
  const f = forwardOf(yaw)
  const r = rightOf(yaw)
  const dx = center.x - eye.x
  const dz = center.z - eye.z
  const depth = dx * f.x + dz * f.z
  if (depth <= 0.01) return NO_SHIFT
  return { x: (dx * r.x + dz * r.z) / depth, y: (center.y - eye.y) / depth }
}

/**
 * The view offset (px, for `PerspectiveCamera.setViewOffset`) that applies a shift on a screen of
 * `width` × `height` with a vertical field of view of `fovDeg`.
 */
export const viewOffsetFor = (shift: LensShift, fovDeg: number, width: number, height: number) => {
  const tanV = Math.tan((fovDeg * Math.PI) / 360)
  const tanH = tanV * (width / height)
  return { x: (shift.x / tanH) * (width / 2), y: -(shift.y / tanV) * (height / 2) }
}

/**
 * How far from a work Artwork View stands so all of it, and a margin, fits a screen of `aspect`
 * with the eye's own field of view — before the room and a tall screen have their say.
 */
export const fitDistance = (width: number, height: number, fovDeg: number, aspect: number) => {
  const tanV = Math.tan((fovDeg * Math.PI) / 360)
  const tanH = tanV * aspect
  return Math.max(
    ((height / 2) * FOCUS_PADDING) / tanV,
    ((width / 2) * FOCUS_PADDING) / tanH,
    FOCUS_MIN_DISTANCE,
  )
}
