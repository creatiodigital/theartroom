import { test, expect } from '@playwright/test'
import {
  BufferAttribute,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three'

import { faceBoundingData } from '../src/components/wallview/hooks/useBoundingData'
import { convert2DTo3D } from '../src/components/wallview/utils'

// ---------------------------------------------------------------------------
// The compressed-normals regression (AR-164, found 2026-10-22)
//
// Saving placeholder2 of a Paris show turned every work on it 90° — facing along
// the wall instead of out of it — slid them 5.6 m sideways and mirrored their
// heights. Neither the GLB nor the 2D layout was wrong: since 2026-09-06 Paris
// and Madrid ship meshopt-compressed models (`*_noq.glb`) whose normals are Int8,
// normalized, padded to a 4-byte stride. three.js hands that over as an
// interleaved attribute, the wall's facing was read straight off its raw array
// three numbers at a time, the padding and the end of the array made it NaN, and
// a silent default of +Z took its place.
//
// +Z hid it: placeholder3 faces +Z, so the default happened to be right there,
// and float-normal models (Vienna) never took the broken path at all.
//
// The invariants these lock down: a wall faces the same way however its model
// stores its normals, and a wall whose facing can't be read is never guessed.
// ---------------------------------------------------------------------------

// The four walls of the Paris room, with the facing each has in paris22_noq.
const WALLS = [
  { name: 'placeholder0', normal: new Vector3(-1, 0, 0), turn: -Math.PI / 2 },
  { name: 'placeholder1', normal: new Vector3(0, 0, -1), turn: Math.PI },
  { name: 'placeholder2', normal: new Vector3(1, 0, 0), turn: Math.PI / 2 },
  { name: 'placeholder3', normal: new Vector3(0, 0, 1), turn: 0 },
] as const

// A placeholder as Blender authors it: a plane 11.17 m long and 3.545 m high
// (Paris placeholder2's size), turned to face the room.
const makeWall = (name: string, turn: number) => {
  const geometry = new PlaneGeometry(11.17, 3.545)
  geometry.rotateY(turn)
  geometry.translate(0, 1.7725, 0)
  geometry.computeBoundingBox()
  const mesh = new Mesh(geometry)
  mesh.name = name
  mesh.updateMatrixWorld(true)
  return mesh
}

// The same normals as the compressed models store them: Int8, normalized, each
// x y z followed by one byte of padding (byteStride 4).
const compressNormals = (mesh: Mesh) => {
  const floats = mesh.geometry.getAttribute('normal') as BufferAttribute
  const bytes = new Int8Array(floats.count * 4)
  for (let i = 0; i < floats.count; i++) {
    bytes[i * 4] = Math.round(floats.getX(i) * 127)
    bytes[i * 4 + 1] = Math.round(floats.getY(i) * 127)
    bytes[i * 4 + 2] = Math.round(floats.getZ(i) * 127)
  }
  const interleaved = new InterleavedBufferAttribute(new InterleavedBuffer(bytes, 4), 3, 0, true)
  mesh.geometry.setAttribute('normal', interleaved)
  return mesh
}

// Which way a stored orientation turns an artwork's front (+Z in its own space).
const facingOf = (stored: ReturnType<typeof convert2DTo3D>) =>
  new Vector3(0, 0, 1).applyQuaternion(
    new Quaternion(stored.quaternionX, stored.quaternionY, stored.quaternionZ, stored.quaternionW),
  )

for (const wall of WALLS) {
  test(`an artwork on compressed ${wall.name} faces out of the wall`, () => {
    const data = faceBoundingData(compressNormals(makeWall(wall.name, wall.turn)), null, undefined)
    expect(data, 'the wall gave no geometry').not.toBeNull()

    const facing = facingOf(convert2DTo3D(3337, 791, 155, 104, data!))
    expect(facing.x).toBeCloseTo(wall.normal.x, 6)
    expect(facing.y).toBeCloseTo(wall.normal.y, 6)
    expect(facing.z).toBeCloseTo(wall.normal.z, 6)
  })

  test(`compressed ${wall.name} stores exactly what the uncompressed one does`, () => {
    const plain = faceBoundingData(makeWall(wall.name, wall.turn), null, undefined)
    const packed = faceBoundingData(
      compressNormals(makeWall(wall.name, wall.turn)),
      null,
      undefined,
    )
    expect(plain).not.toBeNull()
    expect(packed).not.toBeNull()

    // Same 2D rect on the same wall: the stored 3D must not depend on how the
    // model happens to store its normals.
    const a = convert2DTo3D(3337, 791, 155, 104, plain!)
    const b = convert2DTo3D(3337, 791, 155, 104, packed!)
    for (const key of Object.keys(a) as (keyof typeof a)[]) {
      expect(b[key], `${key} differs between the two encodings`).toBeCloseTo(a[key], 6)
    }
  })
}

test('a wall whose facing cannot be read gives no geometry instead of a guess', () => {
  // Every normal zero: there is no facing to read. A default here is exactly
  // what wrote +Z into a +X wall, so the wall must give nothing to save.
  const wall = makeWall('placeholder2', Math.PI / 2)
  wall.geometry.setAttribute(
    'normal',
    new BufferAttribute(new Float32Array(wall.geometry.getAttribute('normal').count * 3), 3),
  )
  expect(faceBoundingData(wall, null, undefined)).toBeNull()
})

test('a wall with no normals at all gives no geometry instead of a guess', () => {
  const wall = makeWall('placeholder2', Math.PI / 2)
  wall.geometry.deleteAttribute('normal')
  expect(faceBoundingData(wall, null, undefined)).toBeNull()
})
