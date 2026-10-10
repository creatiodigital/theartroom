import { useEffect, useState } from 'react'

/**
 * Can this browser create the WebGL context the scene renderer needs?
 *
 * The pre-check exists because R3F's `<Canvas>` builds its renderer inside an
 * async `configure()` whose promise it never catches. When the context cannot
 * be created, the failure surfaces as an unhandled rejection that NO error
 * boundary sees — the visitor is left on a blank canvas with no explanation.
 * Asking the browser first lets us show a message instead of mounting a canvas
 * that is doomed to fail.
 *
 * Mirrors what three's `WebGLRenderer` asks for: WebGL2 only (three dropped
 * WebGL1 in r163) with the same attributes, so a pass here means the real
 * renderer gets the same answer.
 */
const canCreateWebGLContext = (attributes: WebGLContextAttributes): boolean => {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2', attributes)
    if (!gl) return false

    // Hand the context straight back — browsers cap live contexts per page
    // (~16), and this one only existed to answer the question.
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

// Shared by the renderer and the pre-check, so the check asks the browser for
// exactly the context the renderer will. `alpha` restates R3F's default.
export const GL_ATTRIBUTES = {
  alpha: true,
  // Intentionally off, and inert either way: `Effects` mounts an
  // EffectComposer in every space, which renders the scene into
  // its own offscreen target — so the default framebuffer's MSAA
  // is never what you see. Antialiasing is configured by the
  // composer's `multisampling` prop, not here. Leaving this false
  // avoids allocating a multisampled framebuffer nothing samples.
  antialias: false,
  powerPreference: 'high-performance',
} satisfies WebGLContextAttributes

// The answer cannot change within a page load, and both the scene and the
// visit page ask — check once, not once per caller.
let cachedAvailability: boolean | undefined

/**
 * `null` until checked. The check needs `document` and the scene is
 * server-rendered, so it runs after mount and callers wait one commit for it.
 */
export const useWebGLAvailable = (): boolean | null => {
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    cachedAvailability ??= canCreateWebGLContext(GL_ATTRIBUTES)
    setAvailable(cachedAvailability)
  }, [])

  return available
}
