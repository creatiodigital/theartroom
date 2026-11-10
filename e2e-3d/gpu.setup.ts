import { expect, test as setup } from '@playwright/test'

/**
 * Runs before any room opens (`rooms` depends on it). WebGL in software (SwiftShader) pegs the CPU
 * and spins the fan — the reason the main suite opens no room at all (owner, 2026-05-30). If this
 * Chrome would render in software, the run stops here.
 */
setup('Chrome renders WebGL on the real GPU, never in software', async ({ page }) => {
  await page.goto('about:blank')
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return null
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
  })
  console.log(`WebGL renderer: ${renderer}`)
  expect(renderer, 'This Chrome has no WebGL 2 at all.').not.toBeNull()
  expect(
    renderer,
    'WebGL would run in SOFTWARE (CPU, fan). Stopping before any room opens. Try `--headed`.',
  ).not.toMatch(/swiftshader|llvmpipe|software|basic render/i)
})
