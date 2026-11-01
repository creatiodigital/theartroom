import { test, expect } from '@playwright/test'
import type { Material, MeshBasicMaterial, WebGLRenderer } from 'three'

import { createArtworkSurfaceMaterial } from '@/components/scene/spaces/objects/Display/artworkFile'

// The paper border is part of the image: it shows exactly its own color, past the screen effects.
// (AR-169, 2026-10-31: the passepartout is no longer shown past them — it is lit like the frame,
// × `PASSEPARTOUT_LIFT` — so AR-165's "half its color, half the room's light" face is gone.)

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

test('without a share of light a surface shows exactly its color (the paper border)', () => {
  const paper = createArtworkSurfaceMaterial('#ffffff')
  expect((paper as MeshBasicMaterial).isMeshBasicMaterial).toBe(true)
  expect(compile(paper).fragmentShader).not.toContain('outgoingLight')
})
