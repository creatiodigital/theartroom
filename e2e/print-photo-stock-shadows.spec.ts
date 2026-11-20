import { test, expect } from '@playwright/test'
import { MeshStandardMaterial, ShaderChunk, type WebGLProgramParametersWithUniforms } from 'three'

import { useStockShadows } from '@/components/printPresentation/photoViews/stockShadows'

/**
 * The photo views render right after the framed studio, whose drei `SoftShadows` REWRITES three's
 * shared shadow shader (`ShaderChunk.shadowmap_pars_fragment`) for the whole page while it's
 * mounted. Inherited by the photo renderer, that 128-sample soft shadow — tuned for the studio's
 * scale — made every photo come out black, and 85× slower (owner's admin, 2026-11-20). The photo
 * materials always compile with three's own shadow code, whatever the page has patched.
 *
 * Logic only.
 */
test('a patched shared shadow shader never reaches the photo materials', () => {
  const original = ShaderChunk.shadowmap_pars_fragment
  try {
    ShaderChunk.shadowmap_pars_fragment = '/* PATCHED BY SOMEONE ELSE */'
    const material = new MeshStandardMaterial()
    useStockShadows(material, (shader) => {
      shader.fragmentShader += '\n/* the material’s own edit */'
    })
    const shader = {
      vertexShader: '',
      fragmentShader: '#include <shadowmap_pars_fragment>\nvoid main() {}',
      uniforms: {},
    } as unknown as WebGLProgramParametersWithUniforms
    material.onBeforeCompile(shader, undefined as never)
    expect(shader.fragmentShader).not.toContain('PATCHED BY SOMEONE ELSE')
    expect(shader.fragmentShader).not.toContain('#include <shadowmap_pars_fragment>')
    expect(shader.fragmentShader).toContain('getShadow(')
    expect(shader.fragmentShader).toContain('the material’s own edit')
    // Its own program, never one compiled with someone else's chunk.
    expect(material.customProgramCacheKey()).toContain('stock-shadows')
  } finally {
    ShaderChunk.shadowmap_pars_fragment = original
  }
})
