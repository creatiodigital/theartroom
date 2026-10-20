import { test, expect } from '@playwright/test'
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Scene } from 'three'
import type { Color, Material, Object3D } from 'three'

import { MAX_FRAME, GIVE_UP, SETTLE, roomSettled, settleStep } from '@/components/scene/bake/settle'
import { artLightById, trackArtworks } from '@/components/scene/bake/applyBake'
import {
  ARTWORK_DISPLAY_NAME,
  artworkUserData,
} from '@/components/scene/spaces/objects/Display/artworkId'

// --- Waiting for the room: visible time, never while anything loads ---------------------------

test('a hidden tab’s catch-up frame counts as one short frame', () => {
  expect(settleStep(0, 120, false)).toBe(MAX_FRAME)
  expect(settleStep(0, -1, false)).toBe(0)
  // One long frame after a hidden tab cannot settle the room, let alone give up on a work.
  expect(roomSettled({ room: true, idle: settleStep(0, 600, false), missing: 1 })).toBe(false)
})

test('anything loading starts the idle count over', () => {
  let idle = 0
  for (let i = 0; i < 100; i++) idle = settleStep(idle, 1 / 60, false)
  expect(idle).toBeGreaterThan(SETTLE)
  expect(settleStep(idle, 1 / 60, true)).toBe(0)
})

test('never settles while loading, however long', () => {
  let idle = 0
  for (let i = 0; i < 60 * 600; i++) idle = settleStep(idle, 1 / 60, true)
  expect(roomSettled({ room: true, idle, missing: 0 })).toBe(false)
  expect(roomSettled({ room: true, idle, missing: 3 })).toBe(false)
})

test('every measured work shown: settles after SETTLE idle; a work missing: only after GIVE_UP', () => {
  expect(roomSettled({ room: true, idle: SETTLE - 0.01, missing: 0 })).toBe(false)
  expect(roomSettled({ room: true, idle: SETTLE, missing: 0 })).toBe(true)
  expect(roomSettled({ room: true, idle: GIVE_UP - 0.01, missing: 1 })).toBe(false)
  expect(roomSettled({ room: true, idle: GIVE_UP, missing: 1 })).toBe(true)
  expect(roomSettled({ room: false, idle: GIVE_UP, missing: 0 })).toBe(false)
})

// --- Late artworks: every artwork the room shows gets the same patches, whenever it arrives -----

const own = (m: Material, key: string) => Object.prototype.hasOwnProperty.call(m, key)
const keyOf = (m: Material) => (own(m, 'customProgramCacheKey') ? m.customProgramCacheKey() : null)

/** The light a patched material adds (its `artBounce` uniform), read off its shader hook. */
const lightOf = (m: Material) => {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    fragmentShader: '#include <lights_fragment_maps>',
  }
  ;(m.onBeforeCompile as (s: unknown) => void)(shader)
  return (shader.uniforms.artBounce?.value as Color | undefined)?.toArray()
}

/**
 * An artwork as `Display` builds it: its own named group with an invisible hit plane and the image
 * two groups down (support offset, lift); framed, also its mat and frame. The image shows its file
 * — an unlit material the bake leaves alone (`artworkFile.ts`).
 */
const artwork = (parent: Object3D, id: string, x: number, framed = true) => {
  const group = new Group()
  group.name = ARTWORK_DISPLAY_NAME
  group.position.set(x, 1.5, 0)
  const image = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial())
  image.name = 'artworkImage'
  image.userData = artworkUserData(id)
  const lift = new Group()
  lift.add(image)
  const support = new Group()
  support.add(lift)
  group.add(new Mesh(new PlaneGeometry(1.3, 1.3), new MeshBasicMaterial({ visible: false })))
  group.add(support)
  const mat = new Mesh(new PlaneGeometry(1.2, 1.2), new MeshStandardMaterial())
  const frame = new Mesh(new PlaneGeometry(1.3, 1.3), new MeshStandardMaterial())
  if (framed) group.add(mat, frame)
  parent.add(group)
  return { group, image, mat, frame }
}

const card = (scene: Scene, x: number) => {
  const mesh = new Mesh(new PlaneGeometry(0.2, 0.1), new MeshStandardMaterial())
  mesh.name = 'textCard'
  mesh.position.set(x, 1.2, 0)
  scene.add(mesh)
  return mesh
}

test("a late artwork's mat, frame and card take the stored light; its image stays its file", () => {
  const scene = new Scene()
  const a = artwork(scene, 'a', 0)
  const cardA = card(scene, 0.8)
  const light = artLightById({ a: [0.1, 0.2, 0.3], b: [0.3, 0.2, 0.1] })
  const art = trackArtworks(scene, light)
  expect(art.update()).toBe(true)
  expect(keyOf(a.image.material as Material)).toBe(null)
  expect(keyOf(a.mat.material as Material)).toBe('baked-art-bounce')
  expect(keyOf(a.frame.material as Material)).toBe('baked-art-bounce')
  expect(keyOf(cardA.material as Material)).toBe('baked-art-bounce')
  expect(art.update()).toBe(false) // nothing changed: nothing re-patched

  // Work b's image loads after the bake went on, with a card beside it.
  const b = artwork(scene, 'b', 5)
  const cardB = card(scene, 5.8)
  expect(art.update()).toBe(true)
  expect(keyOf(b.mat.material as Material)).toBe('baked-art-bounce')
  expect(lightOf(b.mat.material as Material)).toEqual([0.3, 0.2, 0.1])
  expect(keyOf(cardB.material as Material)).toBe('baked-art-bounce')
  expect(keyOf(a.mat.material as Material)).toBe('baked-art-bounce')

  // Work a's mat remounts with a new material (a rebuilt Display).
  a.mat.material = new MeshStandardMaterial()
  expect(art.update()).toBe(true)
  expect(keyOf(a.mat.material as Material)).toBe('baked-art-bounce')

  // A work the bake never measured gets no light.
  const c = artwork(scene, 'c', 10)
  art.update()
  expect(keyOf(c.mat.material as Material)).toBe(null)

  // Undo puts every material back, late ones included.
  art.undo()
  for (const m of [a, b, c].flatMap((w) => [w.image, w.mat, w.frame]).concat([cardA, cardB]))
    expect(keyOf(m.material as Material)).toBe(null)
})

test("a frameless artwork lights only its own parts, never a neighbour's mat", () => {
  // A frameless display has too few parts for "the nearest ancestor with a few parts": that
  // walk climbed into the group every artwork shares and lit the next work's mat with its light.
  const scene = new Scene()
  const room = new Group()
  scene.add(room)
  const a = artwork(room, 'a', 0, false)
  const b = artwork(room, 'b', 3)
  const floor = new Mesh(new PlaneGeometry(10, 10), new MeshStandardMaterial())
  room.add(floor)
  const art = trackArtworks(scene, artLightById({ a: [0.9, 0.9, 0.9], b: [0.1, 0.2, 0.3] }))
  art.update()
  expect(lightOf(b.mat.material as Material)).toEqual([0.1, 0.2, 0.3])
  expect(lightOf(b.frame.material as Material)).toEqual([0.1, 0.2, 0.3])
  // Nothing outside an artwork takes an artwork's light.
  expect(keyOf(floor.material as Material)).toBe(null)
  expect(keyOf(a.image.material as Material)).toBe(null)
})

test('a hidden image is not patched until it shows', () => {
  const scene = new Scene()
  const a = artwork(scene, 'a', 0)
  a.image.visible = false
  const art = trackArtworks(scene, artLightById({ a: [0.1, 0.1, 0.1] }))
  art.update()
  expect(keyOf(a.mat.material as Material)).toBe(null)
  a.image.visible = true
  expect(art.update()).toBe(true)
  expect(keyOf(a.mat.material as Material)).toBe('baked-art-bounce')
})
