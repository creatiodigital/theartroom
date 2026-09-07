import type { Texture } from 'three'

/**
 * Anisotropic filtering level for every surface texture in the gallery.
 *
 * Anisotropy governs sharpness at GRAZING angles — which is not a corner case here, it is the
 * normal way the room is seen. A visitor walks ALONG a wall rather than standing square to it,
 * and the floor recedes to the horizon in every single frame. With anisotropy at 1 (three's
 * default) a mipmapped texture viewed edge-on picks a mip chosen for the shorter axis, so it
 * blurs along the direction you can actually see detail in. That is why a wood floor turns to
 * mush a few metres out.
 *
 * 16 is safe to request unconditionally: three clamps it to the GPU's real limit at upload
 * (`Math.min(texture.anisotropy, capabilities.getMaxAnisotropy())`), so this needs no renderer
 * reference and degrades by itself on weaker hardware.
 *
 * ⚠️ Only takes effect when the texture uses a MIPMAPPED minFilter. three ignores anisotropy
 * for `NearestFilter`/`LinearFilter`, so a texture with `generateMipmaps = false` gains
 * nothing — see `VideoObject`, which deliberately opts out.
 *
 * Cost is memory bandwidth, not shading: extra taps only on surfaces actually seen at an
 * angle. Unlike the AO experiment (rejected 2026-09-07 for costing a resolution step) this
 * does not add a pass, so it should not move the dpr ladder.
 */
export const MAX_ANISOTROPY = 16

/** Apply the gallery's filtering standard to a loaded texture. */
export const applyAnisotropy = (texture: Texture) => {
  texture.anisotropy = MAX_ANISOTROPY
}
