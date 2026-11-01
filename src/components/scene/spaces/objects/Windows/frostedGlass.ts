import type { MeshStandardMaterial } from 'three'

/**
 * ⚠️ AR-169 — what the window glass shows in a baked room, on screen only: the glass's emissive
 * values, which the bake reads as the daylight coming in, are untouched, so the room's light is
 * the same whatever the glass shows. Eduardo 2026-10-30: "I don't know what to 'show' behind that
 * window"; of the three tried on 2026-10-31 (frosted, a city view, the view blown out) he preferred
 * the frosted glass: acid-etched glass — no view, an even glow a little brighter at the top (the
 * sky), with a fine grain so it reads as glass, not paint.
 */

/** × the glass's emissive (0.63): ≈ 1.3, below white so the grain and gradient show. */
const FROSTED_GAIN = 2

/**
 * × the glass's brightness, for one render: the floor's mirror pass (`FloorMirror`) shows the
 * frosted glass at the sky's real brightness — on screen it is dimmed to stay below white.
 */
export const GLASS_GAIN = { value: 1 }

const FROSTED_OUTPUT = `float grain = glassHash( floor( vec2( vGlassWorld.x + vGlassWorld.z, vGlassWorld.y ) * 600.0 ) ) * 2.0 - 1.0;
    float sky = 1.0 + 0.1 * clamp( ( vGlassWorld.y - 1.9 ) / 1.2, -1.0, 1.0 );
    gl_FragColor = vec4( totalEmissiveRadiance * ${FROSTED_GAIN.toFixed(4)} * sky * ( 1.0 + 0.03 * grain ) * glassGain, 1.0 );`

/** The glass material's hooks: the frosted glass's output in place of the lit surface. */
export const frostedGlassPatch: Pick<
  MeshStandardMaterial,
  'onBeforeCompile' | 'customProgramCacheKey'
> = {
  onBeforeCompile: (shader) => {
    shader.uniforms.glassGain = GLASS_GAIN
    shader.vertexShader = `varying vec3 vGlassWorld;\n${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n  vGlassWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;',
    )
    shader.fragmentShader = `varying vec3 vGlassWorld;
uniform float glassGain;
float glassHash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
${shader.fragmentShader}`.replace('#include <opaque_fragment>', FROSTED_OUTPUT)
  },
  customProgramCacheKey: () => 'window-frosted',
}
