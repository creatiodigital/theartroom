import { test, expect } from '@playwright/test'
import { MeshLambertMaterial, Texture } from 'three'

import { TODAY_LOOK, applySurfaceLook, shownFloor } from '../src/components/scene/bake/bakedLook'
import { spaceLooks } from '../src/lib/bake/spaceLooks'

// ---------------------------------------------------------------------------
// The editor's realtime look (AR-164, found 2026-10-22)
//
// Rooms are lit by their bake now; the editor still painted the walls and the
// ceiling with the textures Blender baked for the old models. paris22 moved its
// wall UVs and rebuilt the corridor, so a third of its walls read unpainted parts
// of bw2.ktx2 — black reveals and piers that no visitor ever sees. And it showed
// each exhibition's stored floor (concrete) where every baked room has parquet.
//
// The invariant: the editor shows the room the visitor gets — the artist's paint
// and the space's floor — and no texture made for a model that no longer exists.
// ---------------------------------------------------------------------------

const PARIS = { baked: true, space: spaceLooks.paris!.look } as const

test('the editor paints no pre-baked texture on a wall', () => {
  const wall = new MeshLambertMaterial({ map: new Texture() })
  applySurfaceLook(wall, new Texture(), '#ffffff', TODAY_LOOK)
  expect(wall.map).toBeNull()
  expect(wall.lightMap).toBeNull()
})

test('the baked look keeps its surfaces as approved', () => {
  // Unchanged by AR-164: the stored bake replaces this material when it goes on.
  const wall = new MeshLambertMaterial()
  const texture = new Texture()
  expect(applySurfaceLook(wall, texture, '#ffffff', PARIS)).toBe(true)
  expect(wall.map).toBeNull()
  expect(wall.lightMap).toBe(texture)
})

test("the editor shows a baked space's own floor, not the exhibition's stored one", () => {
  expect(shownFloor(TODAY_LOOK, 'paris')).toBe(spaceLooks.paris!.look.floor)
  expect(shownFloor(TODAY_LOOK, 'madrid')).toBe(spaceLooks.madrid!.look.floor)
  expect(shownFloor(TODAY_LOOK, 'vienna')).toBe(spaceLooks.vienna!.look.floor)
})

test('the baked look shows the floor of its own look', () => {
  expect(shownFloor(PARIS, 'paris')).toBe(PARIS.space.floor)
})

test('a space without a look keeps the exhibition floor', () => {
  expect(shownFloor(TODAY_LOOK, 'not-a-baked-space')).toBeNull()
  expect(shownFloor(TODAY_LOOK, null)).toBeNull()
})
