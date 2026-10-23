import { test, expect } from '@playwright/test'
import { Vector3 } from 'three'
import type { BufferGeometry } from 'three'

import {
  bevelWidth,
  createPassepartoutPiece,
} from '@/components/scene/spaces/objects/Passepartout/passepartoutGeometry'

// AR-165 (Eduardo 2026-10-23): with the passepartout showing exactly its color (AR-163) it "lost
// all 3D dimensionality … no thickness at all". A real passepartout is cut at 45°: the bevel shows
// from the front as a strip around the picture, catching the light by where it faces. Only the
// front face keeps its exact color; the bevel, edges and back take the room's light.

const LENGTH = 0.6 // the strip along the outer edge
const BORDER = 0.05 // the passepartout's width
const DEPTH = 0.004 // its thickness

const triangles = (geometry: BufferGeometry) => {
  const p = geometry.getAttribute('position')
  const n = geometry.getAttribute('normal')
  const out: { centre: Vector3; normal: Vector3; vertices: Vector3[] }[] = []
  for (let i = 0; i < p.count; i += 3) {
    const vertices = [0, 1, 2].map((k) => new Vector3().fromBufferAttribute(p, i + k))
    const centre = vertices.reduce((a, v) => a.add(v), new Vector3()).divideScalar(3)
    out.push({ centre, normal: new Vector3().fromBufferAttribute(n, i), vertices })
  }
  return out
}

/** The winding's normal (counter-clockwise seen from outside) agrees with the stored one. */
const windingAgrees = (t: ReturnType<typeof triangles>[number]) => {
  const [a, b, c] = t.vertices as [Vector3, Vector3, Vector3]
  const wound = b.clone().sub(a).cross(c.clone().sub(a)).normalize()
  return wound.dot(t.normal) > 0.999
}

test('the front face is the flat face toward the visitor, nothing else', () => {
  const { face } = createPassepartoutPiece(LENGTH, BORDER, DEPTH)
  for (const t of triangles(face)) {
    expect(t.normal.z).toBeCloseTo(1)
    for (const v of t.vertices) expect(v.z).toBeCloseTo(DEPTH / 2, 6)
    expect(windingAgrees(t)).toBe(true)
  }
})

test('the window is cut through the board: its bevel faces the opening and the visitor', () => {
  const { body } = createPassepartoutPiece(LENGTH, BORDER, DEPTH)
  // The strip's outer edge is at y = 0, the window below it.
  // (The miters face down too, but sideways, never toward the visitor.)
  const bevel = triangles(body).filter((t) => t.normal.y < -0.1 && t.normal.z > 0.1)
  expect(bevel.length).toBeGreaterThan(0)
  const expected = new Vector3(0, -DEPTH, bevelWidth(BORDER, DEPTH)).normalize()
  for (const t of bevel) {
    expect(t.normal.y).toBeCloseTo(expected.y)
    expect(t.normal.z).toBeCloseTo(expected.z)
  }
})

test('every surface of the body faces out of the strip', () => {
  const { body } = createPassepartoutPiece(LENGTH, BORDER, DEPTH)
  const all = triangles(body)
  const centre = all.reduce((a, t) => a.add(t.centre), new Vector3()).divideScalar(all.length)
  for (const t of all) {
    expect(windingAgrees(t)).toBe(true)
    expect(t.centre.clone().sub(centre).dot(t.normal)).toBeGreaterThan(0)
  }
})

test('the picture shows as much as before: the bevel opens outward from the back edge', () => {
  const { face, body } = createPassepartoutPiece(LENGTH, BORDER, DEPTH)
  const back = triangles(body).filter((t) => t.normal.z < -0.99)
  const backInner = Math.min(...back.flatMap((t) => t.vertices.map((v) => v.y)))
  expect(backInner).toBeCloseTo(-BORDER, 6)
  const frontInner = Math.min(...triangles(face).flatMap((t) => t.vertices.map((v) => v.y)))
  expect(frontInner).toBeCloseTo(-BORDER + bevelWidth(BORDER, DEPTH), 6)
})

test('the bevel shows at most a thick museum board’s 3 mm, and never most of the border', () => {
  // A thin board is cut at 45°: the bevel is as wide as the board is thick.
  expect(bevelWidth(0.05, 0.002)).toBeCloseTo(0.002, 6)
  // Eduardo 2026-10-23, at the stored default 0.6 cm: "it looks way thicker" — a real board is
  // 1.5–3 mm; a thicker one is cut steeper.
  expect(bevelWidth(0.05, 0.006)).toBeCloseTo(0.003, 6)
  expect(bevelWidth(0.002, 0.006)).toBeCloseTo(0.0018, 6)
})
