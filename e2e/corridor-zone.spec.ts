import { test, expect } from '@playwright/test'
import { BufferGeometry, Float32BufferAttribute, Mesh, Vector3 } from 'three'

import { inCorridor, raycastableWalls } from '@/components/scene/bake/zones'

// AR-165: paris22 opened the end wall of the exit corridor (sill 0.53 m, head 2.58 m) for a light
// well. The corridor test cast its rays at eye height only, so through that opening the corner's
// downlight (`recessedLamp7`) saw no wall, counted as a room lamp and got the rooms' 12,500 lm
// instead of the corridor's 3,000 — white pools on the corridor walls (Eduardo 2026-10-23: "I
// still see the light patches on the walls"). An opening is a hole in a wall, never all of it:
// the passage is as wide as its walls are apart.

const CEILING = 3.6

/** A vertical wall rectangle at x = `at` (z from z0 to z1) or z = `at` (x from x0 to x1). */
type Rect = { axis: 'x' | 'z'; at: number; from: number; to: number; y0: number; y1: number }

const wallMesh = (rects: Rect[]) => {
  const positions: number[] = []
  for (const { axis, at, from, to, y0, y1 } of rects) {
    const p = (u: number, y: number) => (axis === 'x' ? [at, y, u] : [u, y, at])
    positions.push(...p(from, y0), ...p(to, y0), ...p(to, y1))
    positions.push(...p(from, y0), ...p(to, y1), ...p(from, y1))
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return raycastableWalls(new Mesh(geometry))
}

const full = (axis: 'x' | 'z', at: number, from: number, to: number): Rect => ({
  axis,
  at,
  from,
  to,
  y0: 0,
  y1: CEILING,
})

/** A wall with an opening from `sill` to `head` across its whole length (a light well). */
const opened = (
  axis: 'x' | 'z',
  at: number,
  from: number,
  to: number,
  sill: number,
  head: number,
) => [
  { axis, at, from, to, y0: 0, y1: sill },
  { axis, at, from, to, y0: head, y1: CEILING },
]

// The lamp sits in the ceiling, as in the model.
const lamp = new Vector3(0, CEILING, 0)

test('a corner whose end wall has an opening at eye height is still a corridor', () => {
  // Paris's corner: a solid wall 1.15 m one side, the opened end wall 3.6 m the other, open far
  // along z (the corridor runs on into the room).
  const walls = wallMesh([full('x', -1.15, -20, 20), ...opened('x', 3.6, -20, 20, 0.53, 2.58)])
  expect(inCorridor(walls, lamp)).toBe(true)
})

test('the same corner with a solid end wall is a corridor (paris21)', () => {
  const walls = wallMesh([full('x', -1.15, -20, 20), full('x', 3.6, -20, 20)])
  expect(inCorridor(walls, lamp)).toBe(true)
})

test('a room with a window in its wall is still a room', () => {
  // 16 m wide and 12 m deep, a window (sill 0.58, head 2.53) in the far wall.
  const walls = wallMesh([
    full('x', -8, -6, 6),
    full('x', 8, -6, 6),
    full('z', 6, -8, 8),
    ...opened('z', -6, -8, 8, 0.58, 2.53),
  ])
  expect(inCorridor(walls, lamp)).toBe(false)
})

test('a full-height passage into a room is not a wall', () => {
  // Walls only on one side within reach: across x the next wall is 16 m away.
  const walls = wallMesh([full('x', -1.15, -20, 20), full('x', 15, -20, 20)])
  expect(inCorridor(walls, lamp)).toBe(false)
})
