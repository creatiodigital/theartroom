import { test, expect } from '@playwright/test'

import {
  beginTouch,
  createTouchGesture,
  endTouch,
  moveTouch,
  touching,
} from '@/components/scene/controls/MainCamera/touchGestures'

/**
 * AR-172 / AR-176: what fingers on the 3D room ask for — the gesture logic alone, no WebGL. A finger
 * counts only on the room itself (the canvas), so the tests give their touches a canvas target.
 */

class FakeCanvas {}
Object.assign(globalThis, { HTMLCanvasElement: FakeCanvas })
const canvas = new FakeCanvas()

type Point = [number, number]
const event = (...points: Point[]) =>
  ({
    touches: points.map(([clientX, clientY]) => ({ clientX, clientY, target: canvas })),
  }) as unknown as TouchEvent

/** Lands the fingers at `from`, then moves them through each frame of `path`; the moves summed. */
const gesture = (from: Point[], ...path: Point[][]) => {
  const g = createTouchGesture()
  beginTouch(g, event(...from), 1)
  let walk = 0
  let step = 0
  let turn = 0
  let zoom: number | null = null
  for (const points of path) {
    const move = moveTouch(g, event(...points))
    walk += move.walk
    step += move.step
    turn += move.turn
    if (move.zoom !== null) zoom = move.zoom
  }
  return { g, walk, step, turn, zoom }
}

test('two fingers sliding right step right, the whole slide counted, nothing turned or zoomed', () => {
  const { g, step, walk, turn, zoom } = gesture(
    [
      [100, 300],
      [160, 300],
    ],
    [
      [105, 301],
      [165, 301],
    ],
    [
      [130, 302],
      [190, 302],
    ],
    [
      [200, 303],
      [260, 303],
    ],
  )
  expect(g.mode).toBe('step')
  // 100 px at 0.01 m a pixel, including the travel that decided it was a step.
  expect(step).toBeCloseTo(1, 5)
  expect(walk).toBe(0)
  expect(turn).toBe(0)
  expect(zoom).toBeNull()
})

test('two fingers sliding left step left', () => {
  const { step } = gesture(
    [
      [300, 300],
      [360, 300],
    ],
    [
      [250, 300],
      [310, 300],
    ],
  )
  expect(step).toBeCloseTo(-0.5, 5)
})

test('fingers spreading apart pinch to zoom, even with one finger still', () => {
  const { g, zoom, step } = gesture(
    [
      [100, 300],
      [200, 300],
    ],
    [
      [100, 300],
      [250, 300],
    ],
  )
  expect(g.mode).toBe('pinch')
  expect(zoom).toBeCloseTo(1.5, 5)
  expect(step).toBe(0)
})

test('two fingers moving up or down together do nothing until they lift', () => {
  const { g, walk, step, turn, zoom } = gesture(
    [
      [100, 300],
      [160, 300],
    ],
    [
      [100, 260],
      [160, 260],
    ],
    [
      [140, 200],
      [200, 200],
    ],
  )
  expect(g.mode).toBe('held')
  expect([walk, step, turn, zoom]).toEqual([0, 0, 0, null])
})

test('nothing is decided, or moved, before the fingers travel 12 px', () => {
  const { g, step, zoom } = gesture(
    [
      [100, 300],
      [160, 300],
    ],
    [
      [108, 300],
      [168, 300],
    ],
  )
  expect(g.mode).toBe('two')
  expect(step).toBe(0)
  expect(zoom).toBeNull()
})

test('a step stays a step when the fingers then drift apart', () => {
  const { g, step, zoom } = gesture(
    [
      [100, 300],
      [160, 300],
    ],
    [
      [130, 300],
      [190, 300],
    ],
    [
      [130, 300],
      [260, 300],
    ],
  )
  expect(g.mode).toBe('step')
  expect(zoom).toBeNull()
  // The midpoint moved 30 px, then 35 more as one finger drifted.
  expect(step).toBeCloseTo(0.65, 5)
})

test('lifting one of two fingers ends the gesture; the finger left behind moves nothing', () => {
  const { g } = gesture(
    [
      [100, 300],
      [160, 300],
    ],
    [
      [130, 300],
      [190, 300],
    ],
  )
  endTouch(g, event([190, 300]))
  expect(touching(g)).toBe(false)
  expect(moveTouch(g, event([300, 300]))).toEqual({ walk: 0, step: 0, turn: 0, zoom: null })
})

test('one finger still walks and turns as before (AR-172)', () => {
  const walked = gesture([[100, 300]], [[100, 320]], [[100, 400]])
  expect(walked.g.mode).toBe('slide')
  expect(walked.walk).toBeCloseTo(1, 5)
  expect(walked.step).toBe(0)

  const turned = gesture([[300, 300]], [[280, 300]], [[200, 300]])
  expect(turned.turn).toBeCloseTo(80, 5) // right to left turns right: 100 px × 0.8
  expect(turned.walk).toBe(0)
  expect(turned.step).toBe(0)
})
