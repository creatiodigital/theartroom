// three's own shadow code, as shipped — not `ShaderChunk.shadowmap_pars_fragment`, which a page
// may have rewritten (drei's SoftShadows does, for as long as it's mounted).
import stockShadowParsFragment from 'three/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js'
import type { Material, WebGLProgramParametersWithUniforms } from 'three'

/**
 * Makes `material` compile with three's stock shadow code, whatever the page has patched into the
 * shared chunk: the framed studio's drei `SoftShadows` (128-sample PCSS, tuned for its own scale)
 * is still mounted while the photo views render, and inherited it made them black and 85× slower.
 * `edit` is the material's own `onBeforeCompile`, run after.
 */
export function withStockShadows(
  material: Material,
  edit?: (shader: WebGLProgramParametersWithUniforms) => void,
): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <shadowmap_pars_fragment>',
      stockShadowParsFragment,
    )
    edit?.(shader)
  }
  // Its own program: never one compiled earlier with someone else's chunk.
  material.customProgramCacheKey = () => `stock-shadows:${edit ? 'edited' : 'plain'}`
}
