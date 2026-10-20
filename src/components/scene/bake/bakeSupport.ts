import { useEffect, useState } from 'react'

import { GL_ATTRIBUTES } from '@/components/scene/webglSupport'

/**
 * ⚠️ AR-161 — can this computer bake the room? `LightBaker` accumulates light additively into
 * float32 render targets: it needs WebGL2 with float render targets (`EXT_color_buffer_float`)
 * and blending into them (`EXT_float_blend`). Visitors never need either (they only apply a
 * stored bake).
 */
export const supportsBaking = (
  gl: WebGLRenderingContext | WebGL2RenderingContext | null | undefined,
): boolean =>
  typeof WebGL2RenderingContext !== 'undefined' &&
  gl instanceof WebGL2RenderingContext &&
  !!gl.getExtension('EXT_color_buffer_float') &&
  !!gl.getExtension('EXT_float_blend')

/** Asks a throwaway context with the renderer's own attributes (`webglSupport.ts`). */
const canBakeHere = (): boolean => {
  try {
    const attributes: WebGLContextAttributes = GL_ATTRIBUTES
    const gl = document.createElement('canvas').getContext('webgl2', attributes)
    const ok = supportsBaking(gl)
    // Browsers cap live contexts per page: hand this one straight back.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return ok
  } catch {
    return false
  }
}

let cachedAnswer: boolean | undefined

/** `null` until checked (it needs `document`); asked only when `enabled`. */
export const useCanBake = (enabled: boolean): boolean | null => {
  const [answer, setAnswer] = useState<boolean | null>(null)
  useEffect(() => {
    if (!enabled) return
    cachedAnswer ??= canBakeHere()
    setAnswer(cachedAnswer)
  }, [enabled])
  return enabled ? answer : null
}
