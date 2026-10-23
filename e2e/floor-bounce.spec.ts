import { test, expect } from '@playwright/test'
import { Color } from 'three'

import { floorBounceAlbedo } from '@/components/scene/bake/floorBounce'
import { luminance } from '@/components/scene/bake/meter'
import { spaceLooks } from '@/lib/bake/spaceLooks'

// AR-165 (Eduardo 2026-10-23): "the floor color is affecting too much the overall color on the
// walls and ceiling … just reduce its influence". The floor keeps its own look (warm soft wood) and
// the room its brightness; only the color its bounce carries onto the room is reduced.

// The common floor's bounce: the whitewash photo's average × the warmest tint (linear).
const WARM_WOOD = new Color(0.45, 0.347, 0.25)

test('the bounce keeps its brightness and carries the given share of the color', () => {
  const half = floorBounceAlbedo(WARM_WOOD, 0.5)
  expect(luminance(half)).toBeCloseTo(luminance(WARM_WOOD), 5)
  const grey = luminance(WARM_WOOD)
  for (const channel of ['r', 'g', 'b'] as const)
    expect(half[channel] - grey).toBeCloseTo((WARM_WOOD[channel] - grey) * 0.5, 5)
  // Still warm, only less so.
  expect(half.r / half.b).toBeGreaterThan(1)
  expect(half.r / half.b).toBeLessThan(WARM_WOOD.r / WARM_WOOD.b)
})

test('all of the color is the physical bounce; none of it a grey of the same brightness', () => {
  const all = floorBounceAlbedo(WARM_WOOD, 1)
  expect([all.r, all.g, all.b]).toEqual([WARM_WOOD.r, WARM_WOOD.g, WARM_WOOD.b])
  const none = floorBounceAlbedo(WARM_WOOD, 0)
  expect(none.r).toBeCloseTo(none.b, 6)
  expect(luminance(none)).toBeCloseTo(luminance(WARM_WOOD), 5)
})

test('the floor’s own color is never changed', () => {
  const albedo = WARM_WOOD.clone()
  floorBounceAlbedo(albedo, 0.5)
  expect(albedo.equals(WARM_WOOD)).toBe(true)
})

test('every baked space reduces its floor’s color on the room', () => {
  for (const space of ['paris', 'vienna', 'madrid']) {
    const share = spaceLooks[space]!.look.floorBounceColor
    expect(share, space).toBeGreaterThan(0)
    expect(share, space).toBeLessThan(1)
  }
})
