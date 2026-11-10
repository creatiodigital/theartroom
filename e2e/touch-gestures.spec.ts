import { test, expect } from '@playwright/test'

import {
  createMouseState,
  moveMouse,
  pressMouse,
  releaseMouse,
  wallMoveKeys,
} from '@/components/scene/controls/MainCamera/helpers'
import {
  CLOSE_UP_WALL_GAP,
  FOCUS_MIN_DISTANCE,
  GLIDE_MAX_S,
  GROUP_FOCUS_MIN_DISTANCE,
  LARGE_SCREEN_FOCUS_PADDING,
  LARGE_SCREEN_GROUP_FOCUS_PADDING,
  GLIDE_MIN_S,
  PHONE_FOCUS_MIN_DISTANCE,
  PITCH_LIMIT,
  WALL_VIEW_EXIT_BACK,
  WALL_VIEW_EXIT_DEPTH,
  artworkViewNearest,
  artworkViewPadding,
  closeUpBlocks,
  exitDepth,
  fitDistance,
  WALL_VIEW_EDGE_BUFFER,
  limitStep,
  wallExtent,
  wallViewLimits,
  viewingDistance,
  wallScroll,
  forwardOf,
  glideDuration,
  lensShiftFor,
  createSwipe,
  readSwipe,
  viewOffsetFor,
  wrapAngle,
  yawOf,
} from '@/components/scene/controls/MainCamera/navigation'
import {
  beginTouch,
  createTouchGesture,
  endTouch,
  moveTouch,
  pinching,
} from '@/components/scene/controls/MainCamera/touchGestures'
import { artworkInfoAction } from '@/components/scene/spaces/objects/artworkInfo'
import { openArtworkModal, showArtworkPanel } from '@/redux/slices/dashboardSlice'

/**
 * How the 3D room reads fingers and the mouse, and the math that places the camera: the logic
 * alone, no WebGL. A finger counts only on the room itself (the canvas), so the tests give their
 * touches a canvas target.
 */

class FakeCanvas {}
Object.assign(globalThis, { HTMLCanvasElement: FakeCanvas })
const canvas = new FakeCanvas()

type Point = [number, number]
const event = (type: string, ...points: Point[]) =>
  ({
    type,
    touches: points.map(([clientX, clientY]) => ({ clientX, clientY, target: canvas })),
  }) as unknown as TouchEvent

/** Lands the fingers at `from` (at time 0), then moves them through each frame of `path`. */
const gesture = (from: Point[], path: Point[][]) => {
  const g = createTouchGesture()
  beginTouch(g, event('touchstart', ...from), 0)
  const sum = { walk: 0, grabX: 0, grabY: 0, slideX: 0, slideY: 0 }
  for (const points of path) {
    const move = moveTouch(g, event('touchmove', ...points))
    sum.walk += move.walk
    sum.grabX += move.grabX
    sum.grabY += move.grabY
    sum.slideX += move.slideX
    sum.slideY += move.slideY
  }
  return { g, ...sum }
}

/** One finger: lands at `from`, then moves through each point of `path`. */
const finger = (from: Point, path: Point[]) =>
  gesture(
    [from],
    path.map((point) => [point]),
  )

const lift = (g: ReturnType<typeof createTouchGesture>, at: number) =>
  endTouch(g, event('touchend'), at)

test('a quick touch that barely moves is a tap, where it landed', () => {
  const { g } = finger([200, 300], [[204, 303]])
  expect(lift(g, 180)).toEqual({ x: 200, y: 300 })
})

test('a touch held too long, or moved past the slop, is not a tap', () => {
  const held = finger([200, 300], [])
  expect(lift(held.g, 450)).toBeNull()
  const moved = finger([200, 300], [[215, 300]])
  expect(lift(moved.g, 120)).toBeNull()
})

test('two fingers are never a tap, even when the last one lifts quickly', () => {
  const g = createTouchGesture()
  beginTouch(g, event('touchstart', [200, 300]), 0)
  beginTouch(g, event('touchstart', [200, 300], [260, 300]), 20)
  endTouch(g, event('touchend', [200, 300]), 60)
  expect(endTouch(g, event('touchend'), 90)).toBeNull()
})

test('one finger sliding right to left grabs the room left, all of the slide', () => {
  const { grabX, grabY, walk } = finger(
    [300, 300],
    [
      [290, 300],
      [260, 301],
      [200, 302],
    ],
  )
  // The room is dragged 100 px left (the head turns right), the slop's first pixels too.
  expect(grabX).toBe(-100)
  expect(grabY).toBe(2)
  // In Wall View the same grab moves over the wall instead of turning (MainCamera).
  expect(walk).toBe(0)
})

test('one finger sliding diagonally turns and tilts at once', () => {
  const { grabX, grabY } = finger(
    [300, 300],
    [
      [306, 312],
      [320, 350],
      [340, 400],
    ],
  )
  expect(grabX).toBe(40)
  expect(grabY).toBe(100)
})

test('one finger no longer walks: sliding up or down only tilts', () => {
  const { walk } = finger([300, 300], [[300, 200]])
  expect(walk).toBe(0)
})

test('fingers spreading apart step forward; coming together step back', () => {
  const apart = gesture(
    [
      [200, 300],
      [260, 300],
    ],
    [
      [
        [190, 300],
        [270, 300],
      ],
      [
        [150, 300],
        [310, 300],
      ],
    ],
  )
  expect(pinching(apart.g)).toBe(true)
  // 100 px of spread, all of it counted (the opening that decided too): 1 m.
  expect(apart.walk).toBeCloseTo(1, 5)
  expect(apart.slideX + apart.slideY).toBe(0)

  const together = gesture(
    [
      [150, 300],
      [310, 300],
    ],
    [
      [
        [170, 300],
        [290, 300],
      ],
    ],
  )
  expect(together.walk).toBeLessThan(0)
})

test('two fingers moving together without pinching neither walk nor look: they slide (over the wall, in Wall View)', () => {
  const { walk, grabX, grabY, slideX, slideY, g } = gesture(
    [
      [200, 300],
      [260, 300],
    ],
    [
      [
        [230, 302],
        [290, 302],
      ],
      [
        [300, 304],
        [360, 304],
      ],
    ],
  )
  expect(g.mode).toBe('held')
  expect(walk + grabX + grabY).toBe(0)
  // Their midpoint's whole travel, the stretch that told them from a pinch too (AR-178, owner, 2026-11-07:
  // "move over the wall will exactly work the same if done with 2 fingers").
  expect(slideX).toBe(100)
  expect(slideY).toBe(4)
})

test('the mouse: a click barely moves, a drag grabs the room both ways at once', () => {
  const click = createMouseState()
  pressMouse(click, 400, 300, true, 0)
  moveMouse(click, 403, 302, true)
  expect(releaseMouse(click, 120)).toEqual({ x: 400, y: 300 })

  // The pixels the room was dragged, all of them (the slop's too), across and up or down at once:
  // the camera turns them into the angles that keep the room (nearly) under the mouse.
  const drag = createMouseState()
  pressMouse(drag, 400, 300, true, 0)
  moveMouse(drag, 420, 290, true)
  moveMouse(drag, 460, 260, true)
  expect(drag.grabX).toBe(60)
  expect(drag.grabY).toBe(-40)
  expect(releaseMouse(drag, 200)).toBeNull()
})

test('a click that began over a button or panel is never a walk', () => {
  const state = createMouseState()
  pressMouse(state, 400, 300, false, 0)
  expect(releaseMouse(state, 80)).toBeNull()
})

test('a glide takes longer the further it goes, within its bounds', () => {
  expect(glideDuration(0.2)).toBe(GLIDE_MIN_S)
  expect(glideDuration(30)).toBe(GLIDE_MAX_S)
  expect(glideDuration(2)).toBeGreaterThan(GLIDE_MIN_S)
  expect(glideDuration(2)).toBeLessThan(GLIDE_MAX_S)
})

test('headings: yaw 0 looks down -z, and the short way round', () => {
  expect(forwardOf(0).z).toBeCloseTo(-1)
  expect(yawOf(1, 0)).toBeCloseTo(-Math.PI / 2)
  expect(wrapAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2)
  expect(PITCH_LIMIT).toBeCloseTo((10 * Math.PI) / 180)
})

test('the lens shift centers a high work for an eye that stays level, and moves the view up', () => {
  // Facing -z from 2 m away, at eye height 1.6; the work is centered 1 m higher.
  const shift = lensShiftFor({ x: 0, y: 1.6, z: 2 }, 0, { x: 0, y: 2.6, z: 0 })
  expect(shift.x).toBeCloseTo(0)
  expect(shift.y).toBeCloseTo(0.5)
  const offset = viewOffsetFor(shift, 50, 800, 600)
  // The view window moves up (three's offsetY lowers it when positive).
  expect(offset.y).toBeLessThan(0)
  expect(offset.x).toBeCloseTo(0)
})

test('Artwork View stands back far enough for the whole work on a tall screen and a wide one', () => {
  const wide = fitDistance(2, 1, 50, 16 / 9)
  const tall = fitDistance(2, 1, 50, 9 / 19.5)
  expect(tall).toBeGreaterThan(wide)
})

/**
 * Where Artwork View stands from a work (or a `group`) of `width` × `height` (m) on a screen of
 * `aspect`.
 */
const standsAt = (width: number, height: number, aspect: number, phone: boolean, group = false) => {
  const nearest = artworkViewNearest(phone, group)
  const fitted = fitDistance(width, height, 50, aspect, nearest, artworkViewPadding(phone, group))
  return viewingDistance(fitted, Infinity, aspect, nearest)
}

/** The share of the screen's height a work `height` m tall fills from `distance` m (a 50° lens). */
const heightFilled = (height: number, distance: number) =>
  height / (2 * distance * Math.tan((50 * Math.PI) / 360))

test('a phone held sideways stands close enough to read a small wall text; a laptop keeps its distance', () => {
  // A 30 × 17 cm wall text, an iPhone held sideways (874 × 338): it wants 19 cm (AR-178, owner,
  // 2026-11-07: "I want to at least read the text when zooming in with rotated view").
  const sideways = 874 / 338
  const phone = standsAt(0.296, 0.166, sideways, true)
  expect(phone).toBeCloseTo(PHONE_FOCUS_MIN_DISTANCE, 2)
  expect(heightFilled(0.166, phone)).toBeGreaterThan(0.85)
  // A 53 × 40 cm framed photo fills it too, as close as it needs and no closer.
  const photo = standsAt(0.529, 0.402, sideways, true)
  expect(photo).toBeGreaterThan(0.4)
  expect(heightFilled(0.402, photo)).toBeGreaterThan(0.9)
  // A laptop's window: no nearer than any walk (AR-178, owner, 2026-11-07: "no need to zoom THAT much in desktop").
  expect(standsAt(0.296, 0.166, 16 / 10, false)).toBe(FOCUS_MIN_DISTANCE)
  // Upright, the photo's width keeps a phone well back, as before.
  expect(standsAt(0.529, 0.402, 402 / 760, true)).toBeGreaterThan(1)
})

test("on a laptop a large work never touches the window's edges: a clear margin all round", () => {
  // A 1.0 × 0.67 m unframed print (Florescere's), a window 1.95 times as wide as tall.
  const aspect = 1.95
  const distance = standsAt(1.003, 0.668, aspect, false)
  const filled = heightFilled(0.668, distance)
  const across = 1.003 / (2 * distance * Math.tan((50 * Math.PI) / 360) * aspect)
  expect(filled).toBeLessThan(0.9)
  expect(across).toBeLessThan(0.9)
})

test('on a laptop a wall text grouped with its photo comes nearer than a single work, phones as before', () => {
  // Kritzendorf's Group 1: a 30 × 17 cm text beside a framed 53 × 40 cm photo, 86 × 40 cm in all,
  // in a window 1.72 times as wide as tall (AR-178, owner, 2026-11-10: "we still can get closer on
  // that text + photo group"). At the walls' clearance (0.75 m) it filled 70% of the width.
  const aspect = 1.72
  const distance = standsAt(0.855, 0.402, aspect, false, true)
  expect(distance).toBeGreaterThan(GROUP_FOCUS_MIN_DISTANCE)
  expect(distance).toBeLessThan(0.6)
  const across = 0.855 / (2 * distance * Math.tan((50 * Math.PI) / 360) * aspect)
  expect(across).toBeCloseTo(1 / LARGE_SCREEN_GROUP_FOCUS_PADDING, 2)
  // Out of the walk's slanted feelers' reach (0.7 m at 45°), so moves from there need no close-up checks.
  expect(GROUP_FOCUS_MIN_DISTANCE).toBeGreaterThan(0.7 * Math.SQRT1_2)
  // A single work keeps its distance and margin (owner: "for individual works, it's already very good").
  expect(standsAt(0.296, 0.166, aspect, false)).toBe(FOCUS_MIN_DISTANCE)
  expect(artworkViewPadding(false, false)).toBe(LARGE_SCREEN_FOCUS_PADDING)
  // A phone: the same for a group as for a single work ("do not touch mobile").
  const sideways = 874 / 338
  expect(artworkViewNearest(true, true)).toBe(artworkViewNearest(true, false))
  expect(artworkViewPadding(true, true)).toBe(artworkViewPadding(true, false))
  expect(standsAt(0.855, 0.402, sideways, true, true)).toBe(standsAt(0.855, 0.402, sideways, true))
})

test('up close on a phone, a wall stops only a move toward it, and never lets the eye nearer than its gap', () => {
  // The wall's normal faces the eye (which stands on its +z side).
  const wall = { x: 0, z: 1 }
  // Sliding along it 20 cm away, to the next work: free.
  expect(closeUpBlocks({ x: 0.1, z: 0 }, wall, 0.2)).toBe(false)
  expect(closeUpBlocks({ x: -0.1, z: 0 }, wall, 0.2)).toBe(false)
  // Stepping back or away along it: free, however near.
  expect(closeUpBlocks({ x: 0.05, z: 0.1 }, wall, 0.12)).toBe(false)
  // Into it: stopped.
  expect(closeUpBlocks({ x: 0.1, z: -0.05 }, wall, 0.5)).toBe(true)
  expect(closeUpBlocks({ x: 0, z: -0.01 }, wall, 0.5)).toBe(true)
  // A slide half a degree off square drifts in, but only down to the gap.
  const drift = { x: 0.1, z: -0.1 * Math.tan((0.5 * Math.PI) / 180) }
  expect(closeUpBlocks(drift, wall, 0.2)).toBe(false)
  expect(closeUpBlocks(drift, wall, CLOSE_UP_WALL_GAP + 0.0005)).toBe(true)
})

/** Scrolls one swipe's events (each [deltaX, deltaY]) every 16 ms from `from`; the moves summed. */
const scroll = (swipe: ReturnType<typeof createSwipe>, events: [number, number][], from = 0) => {
  const sum = { grabX: 0, walkY: 0 }
  events.forEach(([dx, dy], i) => {
    const move = readSwipe(swipe, dx, dy, from + i * 16)
    sum.grabX += move.grabX
    sum.walkY += move.walkY
  })
  return sum
}

const repeat = (n: number, event: [number, number]) => Array.from({ length: n }, () => event)

test('a swipe sideways turns; up or down walks (natural scrolling: a slide right is a negative deltaX)', () => {
  const turn = scroll(createSwipe(), repeat(10, [-8, 1]))
  expect(turn.grabX).toBeGreaterThan(70)
  expect(turn.walkY).toBe(0)
  const walk = scroll(createSwipe(), repeat(10, [1, 8]))
  expect(walk.walkY).toBeGreaterThan(70)
  expect(walk.grabX).toBe(0)
})

test('a turn, then a walk straight after, its momentum still coming: the walk walks (and back again)', () => {
  const swipe = createSwipe()
  // A turn, then its momentum fading, then fingers swiping forward with no pause in between.
  scroll(swipe, [...repeat(10, [-8, 0]), ...repeat(10, [-1, 0])])
  const walk = scroll(swipe, repeat(12, [0, 8]), 320)
  expect(walk.walkY).toBeGreaterThan(50)
  // And a turn straight after the walk.
  const turn = scroll(swipe, repeat(12, [-8, 0]), 520)
  expect(turn.grabX).toBeGreaterThan(50)
})

test('a swipe sideways keeps its way through a small wobble', () => {
  const swipe = createSwipe()
  const move = scroll(swipe, [...repeat(8, [-8, 0]), [-2, 3], [-8, 0], ...repeat(6, [-8, 0])])
  expect(move.walkY).toBe(0)
})

test('a swipe ignores its first noisy scroll and empty events', () => {
  const move = scroll(createSwipe(), [[0, 0], [0, 1], ...repeat(10, [-8, 0])])
  expect(move.walkY).toBe(0)
  expect(move.grabX).toBeGreaterThan(70)
})

// ---------------------------------------------------------------------------
// Wall View (Artwork View): stuck to the wall, every move travels over it, never turning (AR-178, owner,
// 2026-11-07: "you can walk the wall up and down, left and right, like a spider").

test('in Wall View a swipe or a wheel drags the wall as a page scrolls, both ways at once', () => {
  // Natural scrolling: fingers sliding up and to the right send deltaY > 0 and deltaX < 0; the wall
  // follows them, up and right, as the room does under a finger (grab px, right and down positive).
  const grab = wallScroll(-30, 20)
  expect(grab.x).toBe(30)
  expect(grab.y).toBe(-20)
})

test('in Wall View the arrows and W A S D move over the wall: up and down, left and right', () => {
  expect(wallMoveKeys({ current: { arrowup: true } })).toEqual({ x: 0, y: 1 })
  expect(wallMoveKeys({ current: { s: true, a: true } })).toEqual({ x: -1, y: -1 })
  expect(wallMoveKeys({ current: { d: true, arrowright: true } })).toEqual({ x: 1, y: 0 })
  // Both ways at once cancel out.
  expect(wallMoveKeys({ current: { w: true, arrowdown: true } })).toEqual({ x: 0, y: 0 })
})

test("a wall's extent is its own, along it and up it, however it stands in the room", () => {
  // A 4 × 3 m wall standing at 45°, from 0.2 m to 3.2 m up, its middle at (2, 2): measured along
  // the floor's way across it (the view's right) and up.
  const right = { x: Math.SQRT1_2, z: -Math.SQRT1_2 }
  const corner = (along: number, y: number) => ({
    x: 2 + along * right.x,
    y,
    z: 2 + along * right.z,
  })
  const extent = wallExtent(
    [corner(-2, 0.2), corner(2, 0.2), corner(2, 3.2), corner(-2, 3.2)],
    right,
  )
  expect(extent!.right - extent!.left).toBeCloseTo(4)
  expect(extent!.bottom).toBeCloseTo(0.2)
  expect(extent!.top).toBeCloseTo(3.2)
  expect(wallExtent([], right)).toBeNull()
})

test('in Wall View the eye stays on its placeholder: four clear limits, a buffer off the floor and the ceiling', () => {
  // A placeholder 4 m long (0 to 4 along) from the floor to a 3.2 m ceiling.
  const { along, height } = wallViewLimits({ left: 0, right: 4, bottom: 0, top: 3.2 })
  expect(along).toEqual({ min: 0, max: 4 })
  expect(height.min).toBeGreaterThanOrEqual(WALL_VIEW_EDGE_BUFFER)
  expect(height.max).toBeCloseTo(3.2 - WALL_VIEW_EDGE_BUFFER)
  // A step stops at a limit; at the limit only the way back is open.
  expect(limitStep(3.9, 0.3, along)).toBeCloseTo(0.1)
  expect(limitStep(0.1, -0.3, along)).toBeCloseTo(-0.1)
  expect(limitStep(2, 0.3, along)).toBeCloseTo(0.3)
  expect(limitStep(4, 0.2, along)).toBe(0)
  expect(limitStep(4, -0.2, along)).toBeCloseTo(-0.2)
  // Somewhere outside (framed off the placeholder's edge): no push back in, only a way back.
  expect(limitStep(4.3, 0.1, along)).toBe(0)
  expect(limitStep(4.3, -0.1, along)).toBeCloseTo(-0.1)
  // A placeholder too short for both buffers holds the eye at its middle.
  expect(wallViewLimits({ left: 0, right: 1, bottom: 1.4, top: 1.8 }).height).toEqual({
    min: 1.6,
    max: 1.6,
  })
})

test('leaving Wall View steps a little farther back, and never ends right against the wall', () => {
  // From a hand's width away (a wall text on a phone): a comfortable step back.
  expect(exitDepth(0.2)).toBeCloseTo(WALL_VIEW_EXIT_DEPTH)
  // From a large work, already well back: a little farther.
  expect(exitDepth(2)).toBeCloseTo(2 + WALL_VIEW_EXIT_BACK)
})

test('a double tap or click goes straight to the details on every screen; the editor keeps its panel', () => {
  // Phones first (AR-177), then tablets and laptops (owner, 2026-11-10: "this drawer sidebar is
  // redundant in desktop and tablet").
  expect(artworkInfoAction(false)).toEqual(openArtworkModal())
  // The editor has no details screen: it keeps the panel.
  expect(artworkInfoAction(true)).toEqual(showArtworkPanel())
})
