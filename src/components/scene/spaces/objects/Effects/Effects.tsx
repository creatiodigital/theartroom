import { EffectComposer, ToneMapping, FXAA } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

/**
 * Post-processing for every space. Mounted with `enabled` true in Paris, Madrid
 * and Vienna, which means the scene always renders through this composer rather
 * than to the default framebuffer — so this file, not the `<Canvas gl>` prop, is
 * where antialiasing is decided.
 *
 * - MSAA: geometry-edge antialiasing (see `MULTISAMPLING` below)
 * - FXAA: catches the edges MSAA structurally cannot — see below
 * - Tone mapping: ACES Filmic for cinematic colour grading
 */

/**
 * MSAA sample count for the composer's render target.
 *
 * Affordable because MSAA shades ONCE PER PIXEL, not once per sample — the
 * expensive part of this scene is a fragment shader evaluating 22 spotlights
 * across full-screen wall quads, and that cost does not multiply here. Extra
 * shading happens only where a triangle edge crosses a pixel, and the whole
 * architecture is ~1,500 triangles of large flat quads.
 *
 * What it DOES cost is render-target memory and resolve bandwidth, and that is
 * not free: at dpr 1.5 a 5K panel is 3840×2160 ≈ 8.3M pixels, so colour + depth
 * runs ~66 MB per sample — ~133 MB at 2×, ~265 MB at 4×, on top of ~344 MB of
 * textures. Hence 2×: measure with `ScenePerfHud` (fps AND texture memory)
 * before considering 4×.
 *
 * ⚠️ MSAA does NOT touch the wall labels. Troika draws glyphs as fragment-shader
 * alpha on a quad; MSAA antialiases geometry edges only. Distant-text shimmer is
 * a dpr/sampling problem — see the DPR ladder in `scene/index.tsx`.
 */
const MULTISAMPLING = 2

interface EffectsProps {
  enabled?: boolean
}

export const Effects: React.FC<EffectsProps> = ({ enabled = false }) => {
  if (!enabled) return null

  return (
    <EffectComposer multisampling={MULTISAMPLING}>
      {/* Kept alongside MSAA on purpose rather than as a cheaper substitute for
          it: FXAA works on the resolved image, so it is the only pass that
          softens edges MSAA cannot see — troika's SDF glyphs and any alpha-cut
          material. It cannot fix temporal shimmer (single-frame, no sub-pixel
          history), so do not expect it to. */}
      <FXAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

export default Effects
