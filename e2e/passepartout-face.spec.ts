import { test, expect } from '@playwright/test'
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Scene } from 'three'
import type { Material, MeshStandardMaterial, WebGLRenderer } from 'three'

import { artLightById, trackArtworks } from '@/components/scene/bake/applyBake'
import {
  ARTWORK_FILE_ALPHA,
  PASSEPARTOUT_FACE_LIT,
  ROOM_CAMERA,
  createArtworkSurfaceMaterial,
} from '@/components/scene/spaces/objects/Display/artworkFile'
import {
  ARTWORK_DISPLAY_NAME,
  artworkUserData,
} from '@/components/scene/spaces/objects/Display/artworkId'

// AR-165 (Eduardo 2026-10-23): the passepartout's face at exactly its color looked "a little fake
// (too perfect), too white … half baked half white color?". In the baked look the face shows half
// its own color, half what the room's light makes of it through the room's camera (its exposure
// and white balance) — still past the screen effects, like the image. The paper border stays exact.

/** A fragment shader with the hooks the patches look for, as three's standard material has. */
const standardFragment = () => ({
  uniforms: {} as Record<string, { value: unknown }>,
  fragmentShader: '#include <lights_fragment_maps>\n#include <opaque_fragment>',
})

const compile = (material: Material) => {
  const shader = standardFragment()
  material.onBeforeCompile(shader as never, {} as WebGLRenderer)
  return shader
}

test('the face takes the room’s light and shows half its color, half that light', () => {
  const face = createArtworkSurfaceMaterial('#ffffff', PASSEPARTOUT_FACE_LIT)
  expect((face as MeshStandardMaterial).isMeshStandardMaterial).toBe(true)
  const shader = compile(face)
  expect(shader.fragmentShader).toContain(`${PASSEPARTOUT_FACE_LIT.toFixed(2)}`)
  expect(shader.fragmentShader).toContain('outgoingLight')
  // Past the screen effects, like the image: it writes the image's marker.
  expect(shader.fragmentShader).toContain(`${ARTWORK_FILE_ALPHA.toFixed(2)} )`)
  // Through the room's camera, kept current by the screen effects.
  expect(shader.uniforms.roomExposure).toBe(ROOM_CAMERA.exposure)
  expect(shader.uniforms.roomWhiteBalance).toBe(ROOM_CAMERA.whiteBalance)
  expect(PASSEPARTOUT_FACE_LIT).toBeGreaterThan(0)
  expect(PASSEPARTOUT_FACE_LIT).toBeLessThan(1)
})

test('without a share of light a surface shows exactly its color (the paper border)', () => {
  const paper = createArtworkSurfaceMaterial('#ffffff')
  expect((paper as MeshBasicMaterial).isMeshBasicMaterial).toBe(true)
  expect(compile(paper).fragmentShader).not.toContain('outgoingLight')
})

test('the stored bake adds its measured light to the face and keeps the face’s own shader', () => {
  const scene = new Scene()
  const group = new Group()
  group.name = ARTWORK_DISPLAY_NAME
  const image = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial())
  image.name = 'artworkImage'
  image.userData = artworkUserData('a')
  const face = createArtworkSurfaceMaterial('#ffffff', PASSEPARTOUT_FACE_LIT)
  const ownCompile = face.onBeforeCompile
  const ownKey = face.customProgramCacheKey()
  group.add(image, new Mesh(new PlaneGeometry(1.2, 1.2), face))
  scene.add(group)

  const art = trackArtworks(scene, artLightById({ a: [0.1, 0.2, 0.3] }))
  art.update()
  const shader = compile(face)
  expect((shader.uniforms.artBounce?.value as { toArray(): number[] }).toArray()).toEqual([
    0.1, 0.2, 0.3,
  ])
  expect(shader.fragmentShader).toContain(`${PASSEPARTOUT_FACE_LIT.toFixed(2)}`)
  expect(face.customProgramCacheKey()).not.toBe(ownKey)

  art.undo()
  expect(face.onBeforeCompile).toBe(ownCompile)
  expect(face.customProgramCacheKey()).toBe(ownKey)
})
