import { test, expect } from '@playwright/test'

import {
  createMouseState,
  moveMouse,
  pressMouse,
  releaseMouse,
} from '@/components/scene/controls/MainCamera/helpers'
import {
  GLIDE_MAX_S,
  GLIDE_MIN_S,
  PITCH_LIMIT,
  fitDistance,
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
  const sum = { walk: 0, grabX: 0, grabY: 0, leave: false }
  for (const points of path) {
    const move = moveTouch(g, event('touchmove', ...points))
    sum.walk += move.walk
    sum.grabX += move.grabX
    sum.grabY += move.grabY
    sum.leave ||= move.leave
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

test('one finger sliding right to left grabs the room left, all of the slide (and leaves a work)', () => {
  const { grabX, grabY, walk, leave } = finger(
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
  expect(walk).toBe(0)
  // Looking around steps back from a work: where to look next is the visitor's choice.
  expect(leave).toBe(true)
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

test('a slide that sets off within ~31° of level is sideways (a phone facing a work walks along the wall)', () => {
  expect(finger([300, 300], [[315, 305]]).g.sideways).toBe(true)
  expect(finger([300, 300], [[288, 296]]).g.sideways).toBe(true)
  // Steeper than the slope, or up and down: it looks around as usual.
  expect(finger([300, 300], [[310, 309]]).g.sideways).toBe(false)
  expect(finger([300, 300], [[302, 315]]).g.sideways).toBe(false)
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
  expect(apart.leave).toBe(true)

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

test('two fingers moving together without pinching do nothing', () => {
  const { walk, grabX, grabY, g } = gesture(
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

/** Scrolls one swipe's events (each [deltaX, deltaY]) every 16 ms from `from`; the moves summed. */
const scroll = (
  swipe: ReturnType<typeof createSwipe>,
  events: [number, number][],
  artworkView = false,
  from = 0,
) => {
  const sum = { grabX: 0, along: 0, walkY: 0, leave: false }
  events.forEach(([dx, dy], i) => {
    const move = readSwipe(swipe, dx, dy, from + i * 16, artworkView)
    if (move.along) sum.along += move.grabX
    else sum.grabX += move.grabX
    sum.walkY += move.walkY
    sum.leave ||= move.leave
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
  const walk = scroll(swipe, repeat(12, [0, 8]), false, 320)
  expect(walk.walkY).toBeGreaterThan(50)
  // And a turn straight after the walk.
  const turn = scroll(swipe, repeat(12, [-8, 0]), false, 520)
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

test('facing a work, a swipe sideways walks along the wall and stays; up or down walks and leaves', () => {
  const along = scroll(createSwipe(), repeat(10, [-8, 1]), true)
  expect(along.along).toBeGreaterThan(70)
  expect(along.grabX).toBe(0)
  expect(along.leave).toBe(false)
  const away = scroll(createSwipe(), repeat(10, [1, 8]), true)
  expect(away.walkY).toBeGreaterThan(70)
  expect(away.leave).toBe(true)
})

test('a double tap goes straight to the details on a phone; elsewhere it opens the side panel', () => {
  expect(artworkInfoAction(true, false)).toEqual(openArtworkModal())
  expect(artworkInfoAction(false, false)).toEqual(showArtworkPanel())
  // The editor has no details screen: a phone there keeps the panel.
  expect(artworkInfoAction(true, true)).toEqual(showArtworkPanel())
})
