import type { MeshStandardMaterial } from 'three'

/**
 * Gives a panel both surface and FORM, without a texture and without a light.
 *
 * Two problems, one injection point.
 *
 * 1. No volume. The light reaching a panel standing in open floor is very
 *    nearly all ambient, and ambient hits every face equally whatever way it
 *    points — so a panel's front face and its end face shade identically and
 *    the whole thing reads as a flat cut-out. The room's walls escape this only
 *    because their form is painted into a baked lightmap. A real fill light is
 *    not available: 22 spotlights already sit against MAX_TEXTURE_IMAGE_UNITS
 *    of 16 (see ShadowDecal). So the shading is faked here, from the surface
 *    normal — a soft key from above and one side, and a gentle sky-to-ground
 *    gradient. Cheap, and it only touches panels.
 *
 * 2. No surface. Six square metres of one flat value reads as a CG box. The
 *    grain below breaks it up — sampled from WORLD POSITION rather than UV,
 *    because a panel's UVs come from Blender and nothing here controls them.
 *    (The room's own bgw1.ktx2 was tried: it is baked to the WALLS' unwrap and
 *    drew their UV islands across the panel as visible bands.)
 *
 * Everything is deliberately faint. Gallery paint is nearly uniform; the job is
 * to stop the eye reading "box", not to make the panel interesting.
 */

/** Direction the fake key comes from — above, and off to one side. */
const KEY_DIRECTION = 'normalize(vec3(0.45, 0.78, 0.44))'

/** Shading range for the key: face turned away, face turned into it. */
const KEY_MIN = 0.84
const KEY_MAX = 1.08

/** Sky-to-ground gradient, so up-facing surfaces sit brighter than down. */
const SKY_MIN = 0.94
const SKY_MAX = 1.04

/**
 * Fake ambient occlusion at the floor.
 *
 * A real object darkens where it meets the ground — that is the single
 * strongest cue that it is RESTING on something rather than hovering above it.
 * Real AO would do this and is not available: measured 2026-09-07 at 47fps
 * against a bar of flat 60, and rejected (see the note in Effects.tsx).
 *
 * Without it a panel is lit identically at its base and at eye height, so the
 * contact shadow on the floor has to carry the whole illusion alone — and it
 * cannot, because a bright surface sitting above a dark line reads as a gap.
 * Tuning the shadow does not fix this; the panel itself has to get darker.
 *
 * Cheap: two instructions on a value already in scope, no pass, no texture unit.
 */
const GROUND_HEIGHT = 0.3
const GROUND_MIN = 0.78

/** How much the grain may darken. */
const GRAIN_STRENGTH = 0.04

/** Grain blotches per metre. Low = broad patches, high = fine tooth. */
const GRAIN_FREQUENCY = 1.6

const f = (n: number) => n.toFixed(3)

export const applyPanelSurface = (material: MeshStandardMaterial, baseY = 0): void => {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPanelWorld;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vPanelWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vPanelWorld;

float panelHash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

// Value noise, smoothed. One octave is enough for paint.
float panelNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n00 = mix(panelHash(i), panelHash(i + vec3(1.0, 0.0, 0.0)), f.x);
  float n10 = mix(panelHash(i + vec3(0.0, 1.0, 0.0)), panelHash(i + vec3(1.0, 1.0, 0.0)), f.x);
  float n01 = mix(panelHash(i + vec3(0.0, 0.0, 1.0)), panelHash(i + vec3(1.0, 0.0, 1.0)), f.x);
  float n11 = mix(panelHash(i + vec3(0.0, 1.0, 1.0)), panelHash(i + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(n00, n10, f.y), mix(n01, n11, f.y), f.z);
}`,
      )
      // AFTER normal_fragment_begin, which is where \`normal\` becomes available.
      // \`diffuseColor\` is already in scope from further up the shader.
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
{
  float panelKey = dot(normal, ${KEY_DIRECTION}) * 0.5 + 0.5;
  float panelSky = normal.y * 0.5 + 0.5;
  diffuseColor.rgb *= mix(${f(KEY_MIN)}, ${f(KEY_MAX)}, panelKey);
  diffuseColor.rgb *= mix(${f(SKY_MIN)}, ${f(SKY_MAX)}, panelSky);

  // Ground contact. Measured from the panel's OWN base rather than y=0, so a
  // space whose floor sits elsewhere still darkens in the right place.
  float panelGround = smoothstep(0.0, ${f(GROUND_HEIGHT)}, vPanelWorld.y - ${f(baseY)});
  diffuseColor.rgb *= mix(${f(GROUND_MIN)}, 1.0, panelGround);

  float panelGrain = panelNoise(vPanelWorld * ${f(GRAIN_FREQUENCY)});
  diffuseColor.rgb *= 1.0 - ${f(GRAIN_STRENGTH)} * (1.0 - panelGrain);
}`,
      )
  }

  // Panels must not share a compiled program with the room's untouched
  // standard materials, which have none of the above.
  material.customProgramCacheKey = () => `panel-surface-${f(baseY)}`
  material.needsUpdate = true
}
