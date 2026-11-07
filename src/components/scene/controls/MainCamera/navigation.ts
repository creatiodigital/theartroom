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
 *   the lens (as an architect's shift lens does), not by raising the eye: Artwork View, the owner's
 *   "Wall View". There the visitor is stuck to the wall: every move travels over it, up, down and
 *   along, the works square on (AR-178, owner, 2026-11-07: "like a spider"), until they leave it (the Exit
 *   Wall View button, Escape, a pinch), stepping a little back and floating down to eye height.
 *   Where to look next is the visitor's choice: nothing steps along the wall for them.
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

/**
 * Larger screens (laptops, desktops, tablets) keep a wider margin round the work, 7.5% a side: it
 * never touches the window's edges (AR-178, owner, 2026-11-07: "I need to see at least some padding between
 * the artwork and the borders of the browser window", "don't allow it to touch the window browser
 * edges"). A phone keeps `FOCUS_PADDING`, so a small work or a wall text still fills it.
 */
export const LARGE_SCREEN_FOCUS_PADDING = 1.15

/** The margin Artwork View keeps round a work on this screen (the work's size times this). */
export const artworkViewPadding = (phone: boolean) =>
  phone ? FOCUS_PADDING : LARGE_SCREEN_FOCUS_PADDING

/** The closest Artwork View stands to a work (m): never nearer a wall than any walk. */
export const FOCUS_MIN_DISTANCE = WALL_CLEARANCE

/**
 * On a phone, the closest Artwork View stands to a work (m). Held sideways, a phone's screen is
 * short: a small work or a wall text fills it only from a hand's width away (a 30 × 17 cm text
 * wants 19 cm), and from `FOCUS_MIN_DISTANCE` its words were too small to read (AR-178, owner, 2026-11-07:
 * "I want to at least read the text when zooming in with rotated view"). Nearer than the walls'
 * clearance, so a phone's wall checks let it move from there (`closeUpBlocks`). Larger screens
 * keep `FOCUS_MIN_DISTANCE` (owner: "no need to zoom THAT much in desktop and bigger devices").
 */
export const PHONE_FOCUS_MIN_DISTANCE = 0.2

/** The closest Artwork View stands to a work on this screen (m). */
export const artworkViewNearest = (phone: boolean) =>
  phone ? PHONE_FOCUS_MIN_DISTANCE : FOCUS_MIN_DISTANCE

/**
 * A phone turned in Artwork View steps to where the work fits its new shape (AR-178, owner, 2026-11-07:
 * "rotating re-fits is a great idea"), once the screen has kept that shape this long (s): Safari
 * resizes a turning phone in steps as its bars move.
 */
export const REFIT_SETTLE_S = 0.25

/**
 * On a screen taller than wide, the farthest Artwork View steps back (m). Fitting a 3 m wall text
 * across an upright phone would want ~7.5 m, where no wall may stand behind. Beyond it the work's
 * sides are cropped: the eye does not widen.
 */
export const MAX_TALL_FOCUS_DISTANCE = 4

// ---------------------------------------------------------------------------
// Wall View: Artwork View's moves over the wall (AR-178, owner, 2026-11-07: "wall mode will 'stick' the
// camera to the wall in x and y"). A finger, two fingers, the mouse, a swipe or the keys: up and
// down, left and right, never turning, so every work comes square on; on all devices. The eye
// walks along the wall and rises or sinks up it, the lens shift kept, inside four clear limits:
// the placeholder's left and right, its top and bottom (owner: "just constrain the camera to the
// placeholder, which will always be a plane, with 4 clear limits"). Never the room around it: "do
// not rely on 'next' wall geometry ... we could perfectly have an isolated wall", nor a ceiling ray
// ("I could have, for example, a floating ceiling"). The placeholder is the work's hanging surface
// (or a panel's face), as the 2D wall view shows it.

/** The fastest a move over the wall carries on once the finger or mouse lets go (m/s). */
export const MAX_PAN_SPEED = 3

/** The keys move over the wall this many screen heights a second: the nearer, the slower. */
export const WALL_VIEW_KEY_SPEED = 0.6

/** A wall's extent (m): along it (`left` to `right`, measured along the view's right) and up it. */
export type WallExtent = { left: number; right: number; bottom: number; top: number }

/** The extent of a wall's points (world), along `right` (the floor's way along it) and up. */
export const wallExtent = (
  points: readonly { x: number; y: number; z: number }[],
  right: { x: number; z: number },
): WallExtent | null => {
  if (points.length === 0) return null
  const extent = { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity }
  for (const p of points) {
    const along = p.x * right.x + p.z * right.z
    extent.left = Math.min(extent.left, along)
    extent.right = Math.max(extent.right, along)
    extent.bottom = Math.min(extent.bottom, p.y)
    extent.top = Math.max(extent.top, p.y)
  }
  return extent
}

/** A step from `at` that stops at a range's ends; never one that pushes back in from outside it. */
export const limitStep = (at: number, step: number, range: Range) =>
  step > 0
    ? Math.max(0, Math.min(step, range.max - at))
    : Math.min(0, Math.max(step, range.min - at))

/**
 * In Wall View the screen keeps this far (m) inside the placeholder's top and bottom: a placeholder
 * may run from the floor to the ceiling, and the eye never touches either (AR-178, owner, 2026-11-07: "leave
 * some buffer up and down, we don't want the camera to touch the floor or the ceiling").
 */
export const WALL_VIEW_EDGE_BUFFER = 0.25

/** In Wall View the eye never sinks nearer the floor than this (m), whatever the placeholder. */
export const WALL_VIEW_FLOOR_GAP = 0.3

export type Range = { min: number; max: number }

/**
 * Wall View's four limits for the eye on a placeholder of `extent`: its left and right ends, and
 * its bottom and top, each `WALL_VIEW_EDGE_BUFFER` inside (never nearer the floor than
 * `WALL_VIEW_FLOOR_GAP`). A placeholder too short for the buffers holds the eye at its middle.
 */
export const wallViewLimits = (extent: WallExtent): { along: Range; height: Range } => {
  const bottom = Math.max(extent.bottom + WALL_VIEW_EDGE_BUFFER, FLOOR_Y + WALL_VIEW_FLOOR_GAP)
  const top = extent.top - WALL_VIEW_EDGE_BUFFER
  const middle = (extent.bottom + extent.top) / 2
  return {
    along: { min: extent.left, max: extent.right },
    height: bottom <= top ? { min: bottom, max: top } : { min: middle, max: middle },
  }
}

/** A work whose wall can't be found: how far above eye height the eye may still rise (m). */
export const WALL_VIEW_UNKNOWN_RISE = 1.5

/**
 * In Wall View a swipe (Magic Mouse, trackpad) or a wheel drags the wall as it scrolls a page,
 * both ways at once: the grab, as px dragged, right and down positive. With the Mac's natural
 * scrolling, fingers sliding up and right send deltaY > 0 and deltaX < 0: the wall follows them.
 */
export const wallScroll = (deltaX: number, deltaY: number) => ({ x: -deltaX, y: -deltaY })

/**
 * Leaving Wall View steps back from the wall, from where the visitor is on it, floating down to eye
 * height (AR-178, owner, 2026-11-07: "the same position he was on the wall, but make it 'float' down to the
 * ground and a little farther back"): `WALL_VIEW_EXIT_BACK` farther, and at least
 * `WALL_VIEW_EXIT_DEPTH` from it, so a close-up (a wall text on a phone) ends in comfortable sight.
 */
export const WALL_VIEW_EXIT_BACK = 0.6
export const WALL_VIEW_EXIT_DEPTH = 1.2

export const exitDepth = (depth: number) =>
  Math.max(depth + WALL_VIEW_EXIT_BACK, WALL_VIEW_EXIT_DEPTH)

/** How long the eye takes to float back down to its height on leaving Wall View (s, an ease). */
export const FLOAT_DOWN_S = 0.3

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
  /** Sideways (turn) or up and down (walk). */
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
 * What one scroll of a swipe asks, out of Wall View (`wallScroll` there): the room dragged across
 * `grabX` px (a turn), or a walk of `walkY` px (+ is back, as the wheel's deltaY). With the Mac's
 * natural scrolling, fingers sliding right send a negative deltaX: the room is dragged right.
 */
export type SwipeMove = { grabX: number; walkY: number }

const NO_SWIPE: SwipeMove = { grabX: 0, walkY: 0 }

export const readSwipe = (swipe: Swipe, deltaX: number, deltaY: number, now: number): SwipeMove => {
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

  if (swipe.sideways) return { grabX: -x, walkY: 0 }
  return { grabX: 0, walkY: y }
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
 * How far from a work Artwork View stands so all of it, and a margin (`padding`), fits a screen of
 * `aspect` with the eye's own field of view, no nearer than `nearest` — before the room and a tall
 * screen have their say.
 */
export const fitDistance = (
  width: number,
  height: number,
  fovDeg: number,
  aspect: number,
  nearest = FOCUS_MIN_DISTANCE,
  padding = FOCUS_PADDING,
) => {
  const tanV = Math.tan((fovDeg * Math.PI) / 360)
  const tanH = tanV * aspect
  return Math.max(((height / 2) * padding) / tanV, ((width / 2) * padding) / tanH, nearest)
}

/**
 * Where Artwork View stands from a work (m): where it fits (`fitted`), short of the wall behind
 * (`roomLimit`), on a screen taller than wide no farther than `MAX_TALL_FOCUS_DISTANCE`, and never
 * nearer than `nearest`.
 */
export const viewingDistance = (
  fitted: number,
  roomLimit: number,
  aspect: number,
  nearest: number,
) => Math.max(nearest, Math.min(fitted, roomLimit, aspect < 1 ? MAX_TALL_FOCUS_DISTANCE : Infinity))

/** Up close on a phone, the least the eye keeps from a wall (m): beyond the lens's near plane (0.1 m). */
export const CLOSE_UP_WALL_GAP = 0.15

/** A move steeper than this toward a wall (the sine of 2°) is a move into it, not along it. */
const INTO_WALL = Math.sin((2 * Math.PI) / 180)

/**
 * On a phone, which may stand nearer a wall than the walls' clearance (`PHONE_FOCUS_MIN_DISTANCE`),
 * whether a wall a collision ray met stops a move: only a move toward it (`normal` faces the eye,
 * `gap` is how far the eye stands from it, straight out). A slide along the wall to the next work
 * and a step away from it go on; a slide a hair off square drifts in only down to
 * `CLOSE_UP_WALL_GAP`. Elsewhere a ray's wall stops any move with a share along the ray, and from up
 * close the rays reaching the wall faced would stop the slide along it.
 */
export const closeUpBlocks = (
  move: { x: number; z: number },
  normal: { x: number; z: number },
  gap: number,
) => {
  const nearer = -(move.x * normal.x + move.z * normal.z)
  if (nearer <= 0) return false
  return nearer > Math.hypot(move.x, move.z) * INTO_WALL || gap - nearer < CLOSE_UP_WALL_GAP
}
