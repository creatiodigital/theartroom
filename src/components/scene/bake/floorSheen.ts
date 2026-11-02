import { Color, Vector3 } from 'three'
import { RectAreaLightTexturesLib } from 'three/examples/jsm/lights/RectAreaLightTexturesLib.js'

import { BAKE_DEBUG } from './bakedLook'
import type { WindowDaylight } from './daylight'

/**
 * AR-170 — the floor's sheen (Eduardo 2026-11-02, of a Paris apartment's chevron floor: "it shows
 * some perfectly smooth reflection from the day… the parquet is brighter, but you don't see any
 * real reflection. It's just the way the light is spread across the surface"; "I do not want any
 * coat or mirror reflections"). The floor's finish gives back the daylight of each window, spread by
 * its roughness: a soft glow shaped by the window, stretched toward the eye at a slant, sliding as
 * the visitor walks, brighter or duller board by board (its roughness and normal maps). Nothing else
 * is reflected — no walls, art or lamps, no coat. Where the floor would reflect the wall below a sill
 * the window falls outside its lobe: the band along the wall stays dark, as in the photo.
 *
 * Each window the daylight enters through (`brightenWindows`, the bake's area emitters) as an area
 * light at the bake's own radiance, its specular alone, through three's own LTC area-light code
 * (Heitz et al., as `RectAreaLight`) — on the floor only (a scene light would light everything).
 * On screen only: the bake is untouched.
 *
 * At half the finish's full specular (Eduardo, of off / full: "definitely between 1 and 2") —
 * an oiled floor, its finish worn thin, not a varnished one.
 *
 * In development and staging (`BAKE_DEBUG`), to compare: `?floorsheen=0` none, `?floorsheen=K`
 * K × it; `?floorgloss=G` the finish's roughness × G (glossier below 1).
 */
const MAX_WINDOWS = 6

const flag = (name: string, fallback: number, min: number, max: number): number => {
  if (!BAKE_DEBUG || typeof window === 'undefined') return fallback
  const value = new URLSearchParams(window.location.search).get(name)
  const k = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(k) && k >= min && k <= max ? k : fallback
}

const SHEEN_STRENGTH = 0.5

export const floorSheenFlag = (): number => flag('floorsheen', 1, 0, 10)
const floorGlossFlag = (): number => flag('floorgloss', 1, 0.1, 3)

/** A window as an area light: its centre, half-extents (its light along −(halfWidth × halfHeight)). */
export interface SheenWindow {
  center: Vector3
  halfWidth: Vector3
  halfHeight: Vector3
  radiance: Color
}

/**
 * The windows the daylight enters through, as area lights facing the way the bake's emitters face
 * (their area-weighted triangle normal), at `toPhysical` × the radiance they show (the glass shows a
 * share of the daylight it lets in, `GLASS_ON_SCREEN`).
 */
export const sheenWindows = (windows: WindowDaylight[], toPhysical: number): SheenWindow[] =>
  windows.slice(0, MAX_WINDOWS).map(({ mesh, radiance }) => {
    mesh.updateWorldMatrix(true, false)
    const geometry = mesh.geometry
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    const box = geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    const pos = geometry.getAttribute('position')
    const index = geometry.getIndex()
    const count = index ? index.count : pos.count
    const at = (i: number) =>
      new Vector3()
        .fromBufferAttribute(pos, index ? index.getX(i) : i)
        .applyMatrix4(mesh.matrixWorld)
    const facing = new Vector3()
    for (let i = 0; i + 2 < count; i += 3) {
      const a = at(i)
      facing.add(
        at(i + 1)
          .sub(a)
          .cross(at(i + 2).sub(a)),
      )
    }
    if (mesh.matrixWorld.determinant() < 0) facing.negate()
    facing.setY(0).normalize()
    const up = new Vector3(0, 1, 0)
    const across = Math.abs(facing.x) > Math.abs(facing.z) ? size.z : size.x
    return {
      center,
      // −(halfWidth × halfHeight) = facing: the light goes into the room.
      halfWidth: facing
        .clone()
        .cross(up)
        .multiplyScalar(across / 2),
      halfHeight: up.multiplyScalar(size.y / 2),
      radiance: radiance.clone().multiplyScalar(toPhysical),
    }
  })

/** three's LTC tables (as `RectAreaLight` uses them), built once. */
let tables: ReturnType<typeof RectAreaLightTexturesLib.init> | null = null

export const floorSheenUniforms = (windows: SheenWindow[]) => {
  tables ??= RectAreaLightTexturesLib.init()
  const pad = <T>(values: T[], make: () => T) =>
    Array.from({ length: MAX_WINDOWS }, (_, i) => values[i] ?? make())
  return {
    sheenLtc1: { value: tables.LTC_HALF_1 },
    sheenLtc2: { value: tables.LTC_HALF_2 },
    sheenCount: { value: windows.length },
    sheenCenter: {
      value: pad(
        windows.map((w) => w.center),
        () => new Vector3(),
      ),
    },
    sheenHalfWidth: {
      value: pad(
        windows.map((w) => w.halfWidth),
        () => new Vector3(),
      ),
    },
    sheenHalfHeight: {
      value: pad(
        windows.map((w) => w.halfHeight),
        () => new Vector3(),
      ),
    },
    sheenRadiance: {
      value: pad(
        windows.map((w) => w.radiance),
        () => new Color(),
      ),
    },
    sheenStrength: { value: SHEEN_STRENGTH * floorSheenFlag() },
    sheenGloss: { value: floorGlossFlag() },
  }
}

export const SHEEN_FRAGMENT_PARS = /* glsl */ `#define SHEEN_WINDOWS ${MAX_WINDOWS}
uniform sampler2D sheenLtc1;
uniform sampler2D sheenLtc2;
uniform int sheenCount;
uniform vec3 sheenCenter[ SHEEN_WINDOWS ];
uniform vec3 sheenHalfWidth[ SHEEN_WINDOWS ];
uniform vec3 sheenHalfHeight[ SHEEN_WINDOWS ];
uniform vec3 sheenRadiance[ SHEEN_WINDOWS ];
uniform float sheenStrength;
uniform float sheenGloss;
`

/**
 * After the direct light is cleared (the bake has it): each window's specular, as three's
 * `RE_Direct_RectArea_Physical` without its diffuse — in view space, its (perturbed) normal.
 */
export const SHEEN_LIGHT = /* glsl */ `
  {
    float sheenRoughness = clamp( material.roughness * sheenGloss, 0.0525, 1.0 );
    vec2 sheenUv = LTC_Uv( geometryNormal, geometryViewDir, sheenRoughness );
    vec4 sheenT1 = texture2D( sheenLtc1, sheenUv );
    vec4 sheenT2 = texture2D( sheenLtc2, sheenUv );
    mat3 sheenInv = mat3( vec3( sheenT1.x, 0, sheenT1.y ), vec3( 0, 1, 0 ), vec3( sheenT1.z, 0, sheenT1.w ) );
    vec3 sheenFresnel = material.specularColor * sheenT2.x + ( vec3( 1.0 ) - material.specularColor ) * sheenT2.y;
    for ( int i = 0; i < SHEEN_WINDOWS; i ++ ) {
      if ( i >= sheenCount ) break;
      vec3 c = ( viewMatrix * vec4( sheenCenter[ i ], 1.0 ) ).xyz;
      vec3 w = mat3( viewMatrix ) * sheenHalfWidth[ i ];
      vec3 h = mat3( viewMatrix ) * sheenHalfHeight[ i ];
      vec3 rect[ 4 ];
      rect[ 0 ] = c + w - h;
      rect[ 1 ] = c - w - h;
      rect[ 2 ] = c - w + h;
      rect[ 3 ] = c + w + h;
      reflectedLight.directSpecular += sheenRadiance[ i ] * sheenFresnel * sheenStrength
        * LTC_Evaluate( geometryNormal, geometryViewDir, geometryPosition, sheenInv, rect );
    }
  }`
