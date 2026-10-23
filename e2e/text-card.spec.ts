import { test, expect } from '@playwright/test'
import {
  Color,
  CustomBlending,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OneFactor,
  PlaneGeometry,
  Scene,
  Texture,
  ZeroFactor,
} from 'three'
import type { WebGLRenderer } from 'three'

import { applyBakedLighting, artLightById } from '@/components/scene/bake/applyBake'
import {
  ARTWORK_FILE_ALPHA,
  ON_ARTWORK_BLENDING,
  TEXT_CARD_FACE_LIT,
  TEXT_CARD_SHADING,
  createOnArtworkTextMaterial,
} from '@/components/scene/spaces/objects/Display/artworkFile'
import {
  ARTWORK_DISPLAY_NAME,
  artworkUserData,
} from '@/components/scene/spaces/objects/Display/artworkId'

// AR-165 (Eduardo 2026-10-23): the baked text cards showed "some weird dashed line" (their rounded
// edges are hair-thin strips in the card atlas) — "give this card the same treatment we are giving
// to the passepartout". Its face shows mostly its own color past the screen effects, its rounded
// edges and sides the room's light; it takes the light measured at its artwork, not the card
// atlas. Text, border and monogram on it keep its marker, so they show their own color too.

const compile = (onBeforeCompile: (shader: never, renderer: WebGLRenderer) => void) => {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: '#include <beginnormal_vertex>',
    fragmentShader: '#include <lights_fragment_maps>\n#include <opaque_fragment>',
  }
  onBeforeCompile(shader as never, {} as WebGLRenderer)
  return shader
}

test('the face shows the passepartout’s share of light; edges and sides all of it', () => {
  const shader = compile(TEXT_CARD_SHADING.onBeforeCompile)
  // How far each point faces front, from the card's own normal.
  expect(shader.vertexShader).toContain('vFrontness = objectNormal.z')
  expect(shader.fragmentShader).toContain('vFrontness')
  expect(shader.fragmentShader).toContain(TEXT_CARD_FACE_LIT.toFixed(2))
  expect(shader.fragmentShader).toContain(`${ARTWORK_FILE_ALPHA.toFixed(2)} )`)
  expect(TEXT_CARD_SHADING.customProgramCacheKey()).toContain('edges')
})

test('in the stored bake a card keeps its own look and takes its artwork’s light, not the atlas', () => {
  const scene = new Scene()
  const display = new Group()
  display.name = ARTWORK_DISPLAY_NAME
  const image = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial())
  image.name = 'artworkImage'
  image.userData = artworkUserData('a')
  display.add(image)
  const material = Object.assign(new MeshStandardMaterial(), TEXT_CARD_SHADING)
  const card = new Mesh(new PlaneGeometry(0.2, 0.1), material)
  card.name = 'textCard'
  card.position.set(0.8, 0, 0)
  scene.add(display, card)

  const room = applyBakedLighting(
    scene,
    [{ name: 'cards', mesh: new Mesh(), size: 64, albedo: new Color(1, 1, 1), sources: [card] }],
    [{ receiver: 'cards', kind: 'light', texture: new Texture() }],
    null,
    artLightById({ a: [0.1, 0.2, 0.3] }),
  )
  expect(material.lightMap).toBe(null)
  const shader = compile(material.onBeforeCompile)
  expect((shader.uniforms.artBounce?.value as Color).toArray()).toEqual([0.1, 0.2, 0.3])
  expect(shader.fragmentShader).toContain('vFrontness')

  room.undo()
  expect(material.onBeforeCompile).toBe(TEXT_CARD_SHADING.onBeforeCompile)
})

test('text, border and monogram on a card keep its marker underneath', () => {
  // Their color blends in as usual; the alpha below is left as it was — the card's marker (its
  // face shows past the screen effects, and so do they) or the wall's 1 (they go through them).
  expect(ON_ARTWORK_BLENDING.blending).toBe(CustomBlending)
  expect(ON_ARTWORK_BLENDING.blendSrcAlpha).toBe(ZeroFactor)
  expect(ON_ARTWORK_BLENDING.blendDstAlpha).toBe(OneFactor)
  const text = createOnArtworkTextMaterial()
  expect(text.blending).toBe(CustomBlending)
  expect(text.blendDstAlpha).toBe(OneFactor)
  expect(text.transparent).toBe(true)
})
