import { test, expect } from '@playwright/test'

import { COMMON_FLOOR, bakedFloorTiling } from '@/lib/bake/commonFloor'

// AR-163: in a baked space the floor is the space's, but the artist sets the boards' size and
// placement. A tiling counts only once it was set for the space's floor: live exhibitions keep
// the approved tiling until someone moves a slider.

const approved = {
  textureScale: COMMON_FLOOR.textureScale,
  offsetX: COMMON_FLOOR.offsetX,
  offsetY: COMMON_FLOOR.offsetY,
  rotation: COMMON_FLOOR.rotation,
}

test('a tiling set for an earlier floor shows the space’s own', () => {
  expect(
    bakedFloorTiling(COMMON_FLOOR, {
      floorMaterial: 'concrete',
      floorTextureScale: 5,
      floorTextureOffsetX: 0.3,
      floorTextureOffsetY: 0.7,
      floorRotation: 90,
    }),
  ).toEqual(approved)
  expect(bakedFloorTiling(COMMON_FLOOR, {})).toEqual(approved)
})

test('a tiling set for the space’s floor is the artist’s', () => {
  expect(
    bakedFloorTiling(COMMON_FLOOR, {
      floorMaterial: COMMON_FLOOR.material,
      floorTextureScale: 3.5,
      floorTextureOffsetX: 0.25,
      floorTextureOffsetY: 0.5,
      floorRotation: 45,
    }),
  ).toEqual({ textureScale: 3.5, offsetX: 0.25, offsetY: 0.5, rotation: 45 })
})

test('a value the artist never set falls back to the space’s', () => {
  expect(
    bakedFloorTiling(COMMON_FLOOR, { floorMaterial: COMMON_FLOOR.material, floorRotation: 30 }),
  ).toEqual({ ...approved, rotation: 30 })
})
