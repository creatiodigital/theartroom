import { Matrix4, type Texture } from 'three'

import { BAKE_DEBUG } from './bakedLook'

/**
 * ⚠️ AR-169 TRIAL (Eduardo 2026-10-31: the oak "is 0 reflective, which is not 100% realistic";
 * then "a really subtle blur reflection — not a mirror one"). The floor's gloss from a planar
 * reflection: the room drawn mirrored under the floor every frame (`FloorMirror`), blurred (a
 * Kawase blur — stable as the visitor moves, where mip levels crawled), sampled where three read
 * the captured room (`RoomEnvironmentCapture`: one 256 px cube from the eye, wrong parallax on a
 * floor, the window dim). Only the reflection's source changes: three's Fresnel and the oak's
 * roughness response stay. `?floormirror=K` (development): on, K × the blur's spread.
 */
export const floorMirrorFlag = (): number | null => {
  if (!BAKE_DEBUG || typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('floormirror')
  const k = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(k) && k > 0 ? k : null
}

/** What the floor's shader reads, shared with `FloorMirror` (which fills it every frame). */
export const FLOOR_MIRROR = {
  /** The blurred mirror image. */
  floorMirror: { value: null as Texture | null },
  /** World → the mirror image's UV (projective). */
  floorMirrorMatrix: { value: new Matrix4() },
  /** × the reflection (Eduardo 2026-10-31: "too reflective, lower down the reflection"). */
  floorMirrorStrength: { value: 1 },
  /**
   * How far a board's tilt (its normal map) moves the reflected point, in meters (Eduardo
   * 2026-10-31: "add a little more bump… looks pretty flat"): the sheen breaks board by board.
   * In world space, so it stays put as the visitor moves (a view-space nudge swam).
   */
  floorMirrorRelief: { value: 1 },
}

/** `&mirrorrelief=D` (development): the tilt's reach in meters; unset: `MIRROR_RELIEF`. */
export const MIRROR_RELIEF = 1
export const mirrorReliefFlag = (): number => {
  if (!BAKE_DEBUG || typeof window === 'undefined') return MIRROR_RELIEF
  const value = new URLSearchParams(window.location.search).get('mirrorrelief')
  const d = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(d) && d >= 0 && d <= 10 ? d : MIRROR_RELIEF
}

/** `&mirrorstrength=S` (development): × the reflection, 0–1; unset: `MIRROR_STRENGTH`. */
export const MIRROR_STRENGTH = 0.3
export const mirrorStrengthFlag = (): number => {
  if (!BAKE_DEBUG || typeof window === 'undefined') return MIRROR_STRENGTH
  const value = new URLSearchParams(window.location.search).get('mirrorstrength')
  const s = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(s) && s >= 0 && s <= 1 ? s : MIRROR_STRENGTH
}

export const MIRROR_VERTEX_PARS = /* glsl */ `varying vec3 vMirrorWorld;
`

export const MIRROR_VERTEX = /* glsl */ `#include <project_vertex>
  vMirrorWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`

export const MIRROR_FRAGMENT_PARS = /* glsl */ `uniform sampler2D floorMirror;
uniform mat4 floorMirrorMatrix;
uniform float floorMirrorStrength;
uniform float floorMirrorRelief;
varying vec3 vMirrorWorld;
`

/**
 * In place of three's environment specular: the blurred mirror image where this pixel reflects —
 * moved along the floor by the board's tilt (its normal map, in world space).
 */
export const MIRROR_RADIANCE = /* glsl */ `
#if defined( RE_IndirectSpecular )
  {
    vec3 mirrorTilt = inverseTransformDirection( normal, viewMatrix );
    vec4 mirrorAt = floorMirrorMatrix * vec4( vMirrorWorld + vec3( mirrorTilt.x, 0.0, mirrorTilt.z ) * floorMirrorRelief, 1.0 );
    radiance += texture2D( floorMirror, clamp( mirrorAt.xy / mirrorAt.w, 0.001, 0.999 ) ).rgb * floorMirrorStrength;
  }
#endif
`

/** three's environment specular line (`lights_fragment_maps`), which the mirror replaces. */
export const IBL_RADIANCE =
  'radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );'
