import { test, expect } from '@playwright/test'
import { BoxGeometry, Matrix4, Mesh, PlaneGeometry, Vector3 } from 'three'

import { faceBoundingData } from '../src/components/wallview/hooks/useBoundingData'
import { convert2DTo3D } from '../src/components/wallview/utils'

import {
  PANEL_DEFAULT_COLOR,
  isPanelEnabled,
  panelColorOf,
  panelIndexOfFace,
  panelMatrix,
} from '../src/components/scene/spaces/objects/Panel/panelSettings'

// A display panel is a thin freestanding wall the artist drops into the room.
// Its two faces are ordinary GLB placeholders (`panelFront0` / `panelBack0`), so
// once a face is open it behaves like any other wall. What makes it different is
// that the whole thing moves: one matrix repositions the box, both faces, and
// every artwork hung on them, so 2D and 3D can never disagree.

const PIVOT = [5.423, 1.3, 19.751] as const
const move = (m: ReturnType<typeof panelMatrix>, p: readonly [number, number, number]) =>
  new Vector3(...p).applyMatrix4(m)

test('a face wall id reports its panel index', () => {
  expect(panelIndexOfFace('panelFront0')).toBe(0)
  expect(panelIndexOfFace('panelBack0')).toBe(0)
  // Panels are numbered in blocks of ten, one block per room.
  expect(panelIndexOfFace('panelFront10')).toBe(10)
})

test('an ordinary wall is not a panel face', () => {
  expect(panelIndexOfFace('placeholder0')).toBeNull()
  expect(panelIndexOfFace(null)).toBeNull()
  // The panel box itself is not hangable — only its two faces are.
  expect(panelIndexOfFace('panel0')).toBeNull()
})

test('a panel is off until it is switched on', () => {
  // Exhibitions that predate panels must not suddenly grow a wall mid-room.
  expect(isPanelEnabled(undefined)).toBe(false)
  expect(isPanelEnabled({})).toBe(false)
  expect(isPanelEnabled({ enabled: true })).toBe(true)
})

test('a panel with no color set uses the default', () => {
  expect(panelColorOf(undefined)).toBe(PANEL_DEFAULT_COLOR)
  expect(panelColorOf({ color: '#000000' })).toBe('#000000')
})

test('an untouched panel stays exactly where Blender put it', () => {
  const p = move(panelMatrix(undefined, PIVOT), [1, 2, 3])
  expect(p.x).toBeCloseTo(1)
  expect(p.y).toBeCloseTo(2)
  expect(p.z).toBeCloseTo(3)
})

test('moving a panel shifts it in x and z, never in y', () => {
  const p = move(panelMatrix({ x: 2, z: -3 }, PIVOT), [1, 2, 3])
  expect(p.x).toBeCloseTo(3)
  expect(p.y).toBeCloseTo(2)
  expect(p.z).toBeCloseTo(0)
})

test('rotation turns the panel about its own center, not the world origin', () => {
  // The pivot must come back unmoved — that is what "about its own center" means.
  const p = move(panelMatrix({ rotationY: 90 }, PIVOT), PIVOT)
  expect(p.x).toBeCloseTo(PIVOT[0])
  expect(p.z).toBeCloseTo(PIVOT[2])
})

test('a quarter turn swings a point square onto the other axis', () => {
  // One metre in +x of the pivot, turned 90°, lands one metre in -z.
  const start = [PIVOT[0] + 1, PIVOT[1], PIVOT[2]] as const
  const p = move(panelMatrix({ rotationY: 90 }, PIVOT), start)
  expect(p.x).toBeCloseTo(PIVOT[0])
  expect(p.z).toBeCloseTo(PIVOT[2] - 1)
  expect(p.y).toBeCloseTo(PIVOT[1])
})

test('rotation happens before the move, so a rotated panel still lands where asked', () => {
  const p = move(panelMatrix({ x: 10, rotationY: 90 }, PIVOT), PIVOT)
  expect(p.x).toBeCloseTo(PIVOT[0] + 10)
  expect(p.z).toBeCloseTo(PIVOT[2])
})

// ---------------------------------------------------------------------------
// The double-transform regression (2026-09-20)
//
// A panel rotated -90° left its back-face artworks 3.3 m away, floating beside
// the windows. Neither the GLB nor the stored rows were wrong: `useBoundingData`
// was handing world-space geometry to `convert2DTo3D`, so the panel matrix was
// baked into what got SAVED — and then `ArtObjects` applied it a second time on
// the way out.
//
// Identity hid it completely. A panel at its default settings has a matrix that
// costs nothing to apply twice, so every test and every exhibition looked fine
// until the first artist actually moved one.
//
// The invariant these lock down: what is stored describes the face, not the room.
// ---------------------------------------------------------------------------

// A panel face as Blender authors it: a plane on the +X side of the box,
// normal pointing out of it. Mirrors vienna14's `panelFront0`.
const makeFace = (x: number, normalX: 1 | -1) => {
  const geometry = new PlaneGeometry(3.3, 2.586)
  // Face the plane along ±X.
  geometry.rotateY((normalX * Math.PI) / 2)
  geometry.translate(x, 1.293, 26.368)
  geometry.computeBoundingBox()
  const mesh = new Mesh(geometry)
  mesh.name = normalX === 1 ? 'panelFront0' : 'panelBack0'
  mesh.updateMatrixWorld(true)
  return mesh
}

const makePanelBox = () => {
  const geometry = new BoxGeometry(0.156, 2.586, 3.3)
  geometry.translate(3.742, 1.293, 26.368)
  geometry.computeBoundingBox()
  const mesh = new Mesh(geometry)
  mesh.name = 'panel0'
  mesh.updateMatrixWorld(true)
  return mesh
}

// The settings that exposed this in the room.
const MOVED = { enabled: true, x: -3, z: 2, rotationY: -90 }

test('what gets stored for a face does not depend on where its panel stands', () => {
  const face = makeFace(3.82, 1)
  const box = makePanelBox()

  const atRest = faceBoundingData(face, box, undefined)
  const moved = faceBoundingData(face, box, MOVED)
  expect(atRest).not.toBeNull()
  expect(moved).not.toBeNull()

  // Same 2D point on the same face, panel parked vs panel moved and turned.
  const a = convert2DTo3D(120, 80, 100, 100, atRest!)
  const b = convert2DTo3D(120, 80, 100, 100, moved!)

  for (const axis of ['posX3d', 'posY3d', 'posZ3d'] as const) {
    expect(b[axis], `${axis} moved with the panel — the matrix is being baked in`).toBeCloseTo(
      a[axis],
      6,
    )
  }
  // The orientation is stored the same way and was double-rotated by the same bug.
  expect(b.quaternionX).toBeCloseTo(a.quaternionX, 6)
  expect(b.quaternionY).toBeCloseTo(a.quaternionY, 6)
  expect(b.quaternionZ).toBeCloseTo(a.quaternionZ, 6)
  expect(b.quaternionW).toBeCloseTo(a.quaternionW, 6)
})

test('stored position plus the panel matrix lands on the face, once', () => {
  const face = makeFace(3.82, 1)
  const box = makePanelBox()
  const data = faceBoundingData(face, box, MOVED)!

  const stored = convert2DTo3D(120, 80, 100, 100, data)
  const rendered = new Vector3(stored.posX3d, stored.posY3d, stored.posZ3d).applyMatrix4(
    data.panelTransform,
  )

  // Where the front face actually is after the move: the pivot slides to
  // (0.742, 28.368) and a -90° turn swings the +X face onto +Z.
  const faceCentre = new Vector3(3.82, 1.293, 26.368).applyMatrix4(data.panelTransform)
  const facing = new Vector3(1, 0, 0).transformDirection(data.panelTransform)

  // On the plane of the face — distance along the normal is zero.
  const offPlane = rendered.clone().sub(faceCentre).dot(facing)
  expect(Math.abs(offPlane), 'rendered artwork is not on its own panel face').toBeLessThan(1e-6)

  // And within the panel's footprint, not flung out on a pivot-radius arc.
  expect(rendered.distanceTo(faceCentre)).toBeLessThan(3.3)
})

test('an ordinary wall gets an identity transform', () => {
  // Non-panel walls must keep behaving exactly as they did before panels existed.
  const wall = makeFace(3.82, 1)
  wall.name = 'placeholder0'
  const data = faceBoundingData(wall, null, undefined)!
  expect(data.panelTransform.equals(new Matrix4())).toBe(true)
})
