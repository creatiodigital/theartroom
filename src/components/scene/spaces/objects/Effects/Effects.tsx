import { EffectComposer, ToneMapping, FXAA, Bloom } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import type { ReactElement } from 'react'

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

/**
 * EXPERIMENT 2026-09-07 — FXAA off, to sharpen wall text. Revert = set to true.
 *
 * FXAA smears text. It works on the RESOLVED image and cannot tell a glyph edge from a
 * geometry edge, so it blurs letterforms that troika has already antialiased in-shader via
 * screen-space derivatives — a second blur applied to an edge that was never aliased.
 *
 * It was added when the scene had no antialiasing at all. Now that MSAA covers geometry
 * edges, FXAA's remaining job is alpha-cut and SDF edges, which troika handles itself. The
 * question this tests: is wall text at reading distance blurry BECAUSE of FXAA?
 *
 * Dropping it also removes a full-screen pass, so it should cost nothing — a rare change
 * that can only help framerate.
 */
const ENABLE_FXAA = false

/**
 * Bloom on the light fixtures. The lamp bulbs carry `emissive` (round lamps at
 * `lampIntensity`, default 4.0; recessed at 3), but without bloom they render as flat white
 * discs rather than as sources. Bloom is what makes a light read as a light.
 *
 * Runs BEFORE ToneMapping deliberately: bloom is an HDR operation and belongs on linear
 * values, not the graded image. That works because the composer defaults to a HalfFloatType
 * buffer, so values above 1.0 survive to be thresholded.
 *
 * BLOOM_THRESHOLD is the safety catch, and 1.0 was TOO LOW — measured 2026-09-07: a white
 * wall under a close spotlight exceeds 1.0 in linear space, so the lit WALL crossed the
 * threshold and every light pool grew a visible halo. Bloom was acting on a surface catching
 * light instead of on a light source. 2.0 sits above what the walls reach.
 *
 * ⚠️ This threshold also decides WHICH fixtures glow, by emissive level rather than by
 * selection: round (4.0) and recessed (3) are above it and bloom; track lamps are deliberately
 * held at 0.8 in `TrackLamp.tsx` so they do not — Eduardo's call. `SelectiveBloom` would be
 * the structurally correct way to do that, but it costs an extra render pass of the selection.
 * Changing this number silently changes that grouping, and a lamp dimmed far enough in the
 * editor will drop below it and stop glowing.
 *
 * `mipmapBlur` is the modern path: wide, cheap, stable glow instead of a fixed kernel.
 */
const ENABLE_BLOOM = true
const BLOOM_INTENSITY = 0.6
const BLOOM_THRESHOLD = 2.0

/**
 * ❌ FILM GRAIN — TRIED AND REJECTED 2026-09-07. Do not re-propose.
 *
 * The argument was that real photographs carry sensor noise and CG's perfectly clean
 * gradients are a tell, which matters most on large flat wall — i.e. most of a gallery.
 * Implemented with `<Noise premultiply blendFunction={BlendFunction.OVERLAY}>` after tone
 * mapping. Tried at 0.035 (invisible), 0.1 (unconvincing), and 0.25 (deliberately overdone,
 * to prove the pass was reaching the screen at all). Eduardo: "I don't like the film grain."
 *
 * Worth remembering WHY this one was different: every other change that stuck on 2026-09-07
 * corrected something that was actually wrong — an outdoor HDR lighting an interior, FXAA
 * smearing text troika had already antialiased, an expensive skylight no artist could see.
 * Grain corrected nothing; it was an effect layered on a scene that did not need it.
 *
 * ⚠️ NO VIGNETTE either, decided the same day and without implementing it: on a white gallery
 * a vignette reads as a lens effect applied to a photograph of a room, rather than as the room.
 */

/**
 * ❌ AMBIENT OCCLUSION — TRIED AND REJECTED 2026-09-07. Do not re-propose without new facts.
 *
 * The reasoning was sound: real shadow maps are impossible here (22 spotlights exceed
 * MAX_TEXTURE_IMAGE_UNITS(16) — see the note in ShadowDecal), and screen-space AO needs no
 * texture units, so it looked like the natural stand-in for contact shadows. Measured with
 * N8AO, which ships as a dependency of @react-three/postprocessing (no new package):
 *
 *   Round 1 — aoRadius 1.0, intensity 2.0, quality "medium", full res:
 *     60 → 32 fps, and it read as dirt in every corner. "A cheap baked scene."
 *   Round 2 — aoRadius 0.25, intensity 0.6, quality "low", halfRes:
 *     Looked genuinely good — contact shading only, no smudge. Still 47 fps in the VISIT
 *     view (avg 47, dpr pinned at the 1.5 floor) on a nearly EMPTY room. A full show is
 *     worse.
 *
 * The bar is the one floor reflections cleared: a flat 60 with the dpr ladder still able to
 * climb to 1.75. AO could not hold 60 even at the floor resolution, so it costs both
 * framerate AND text sharpness. Radius is the look knob (subtle = SMALL radius, not low
 * intensity); halfRes/quality are the cost knobs and were already at their useful limit.
 *
 * ⚠️ Measure in the VISIT view. The editor reads ~4 fps lower and carries its own texture
 * leak (983 GPU textures with the Floor panel open, versus 33 on the same scene in /visit).
 */

interface EffectsProps {
  enabled?: boolean
}

export const Effects: React.FC<EffectsProps> = ({ enabled = false }) => {
  if (!enabled) return null

  // Built as an array rather than inline conditionals: EffectComposer types its children as
  // `JSX.Element | JSX.Element[]`, so a `false` from `{flag && <X/>}` is a type error, and an
  // empty fragment would put a non-effect child into the chain it walks. Order is the render
  // order — grain goes last so it sits on the graded image, not the linear one.
  const passes: ReactElement[] = []
  if (ENABLE_FXAA) passes.push(<FXAA key="fxaa" />)
  if (ENABLE_BLOOM) {
    passes.push(
      <Bloom
        key="bloom"
        mipmapBlur
        intensity={BLOOM_INTENSITY}
        luminanceThreshold={BLOOM_THRESHOLD}
        luminanceSmoothing={0.08}
        radius={0.7}
      />,
    )
  }
  passes.push(<ToneMapping key="tonemapping" mode={ToneMappingMode.ACES_FILMIC} />)

  return <EffectComposer multisampling={MULTISAMPLING}>{passes}</EffectComposer>
}

export default Effects
