/**
 * Minimal shadow/lighting setup for gallery spaces.
 *
 * PERFORMANCE: Dynamic shadows (PCSS) and multiple lights removed.
 * For baked-texture spaces, lighting should come from:
 * - Baked lightmaps in the GLB
 * - HDRI environment for subtle reflections
 * - Minimal ambient fill only
 */
export const ShadowSetup = () => {
  // All dynamic lighting removed for performance
  // Spaces with baked textures don't need runtime shadows or area lights
  return null
}

export default ShadowSetup
