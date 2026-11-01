import { Vector3, Vector4, type Mesh, type Object3D, type Texture } from 'three'

import { BAKE_DEBUG, LUX_PER_UNIT } from './bakedLook'
import { fillNearFlag, type FillField } from './fillField'

/**
 * ⚠️ AR-169 — the baked look's soft fill: an even white environment's diffuse light on every baked
 * surface, by direction only, blocked by nothing. The bake removed three's environment term
 * (`applyBake`: the room's light is the bake's); this gives a soft one back. The same in every
 * space (one setup for all spaces): not baked, so changing it needs no re-bake.
 *
 * History (runs.md): it began as an outdoor HDRI's light (Eduardo 2026-10-30, approved at 40 lx:
 * "now we're talking!"); then (2026-10-31: "the real problem is that some walls are lit
 * differently than others… cannot we create our own even hdri — something that will soft-light
 * the whole room evenly?" → "go for it") our own EVEN environment — a sphere that glows the same
 * in every direction, in neutral white (the white-light rule). The outdoor HDRI, lit from one
 * side, had given the brightest wall twice the darkest's fill.
 *
 * Written as 9 spherical-harmonic coefficients of irradiance (Ramamoorthi & Hanrahan 2001):
 * E(n) = Σ Âl · Llm · Ylm(n), smooth like any diffuse environment light (`SOFT_FILL_GLSL`).
 */

/**
 * The fill's average illuminance over all directions (lux): the owner's pick (HD40, runs.md), then
 * Eduardo 2026-10-31 (white walls reading grey on Permanence): "increase the hdri intensity a
 * little" → 50; then 120 "much better", 180 "too much" → 120; then the even white environment at
 * 160 — the back wall as bright as the outdoor HDRI's 120 gave it, the window walls calmer; then 100, tilted
 * toward the windows (`WINDOW_FILL_TILT`) and the track lamps ×2 (Eduardo: "we cannot pretend that
 * one small window will illuminate the whole room") (`?softfill=LUX`).
 */
const SOFT_FILL_LUX = 100

/** `?softfill=LUX` (development and staging): another strength to compare; 0 switches it off. */
const fillLux = (): number => {
  const value =
    BAKE_DEBUG && typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('softfill')
      : null
  const lux = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(lux) && lux >= 0 ? lux : SOFT_FILL_LUX
}

/**
 * AR-169 (Eduardo 2026-10-31, the even fill at 160 lx: "floor a little washed-out… especially
 * here", by the window): the even environment lights every wall and the ceiling alike, but the
 * floor — which the downlights and the sun already light from above — only this share of it: the
 * ~40 lx the approved look gave it (the outdoor HDRI at 40 lx put 35.5 on the floor). `?floorfill=S` (0–1)
 * compares; 1 = the same fill everywhere.
 */
const FLOOR_FILL_SHARE = 0.25

const floorShare = (): number => {
  const value =
    BAKE_DEBUG && typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('floorfill')
      : null
  const s = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(s) && s >= 0 && s <= 1 ? s : FLOOR_FILL_SHARE
}

/**
 * AR-169 (Eduardo 2026-10-31: "nothing in the world is that even… let's add imperfections in the
 * light", with a photo of a Paris room lit by its window): the fill comes from the windows — a
 * surface facing them gets `1 + tilt`, one turned away `1 − tilt`, one across their light the
 * same as before. The direction is the room's own: its window glass, as the bake reads it
 * (`windowFillDirection`); a room without windows keeps the even fill. `?filltilt=T` (0–0.9)
 * compares; 0 = even.
 */
const WINDOW_FILL_TILT = 0.5

const fillTilt = (): number => {
  const value =
    BAKE_DEBUG && typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('filltilt')
      : null
  const t = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(t) && t >= 0 && t <= 0.9 ? t : WINDOW_FILL_TILT
}

/** Where the room's daylight travels (its window glass's facing, area-weighted), or null. */
let windowDirection: Vector3 | null = null

/**
 * The direction daylight enters a room: every `windowGlass{i}` triangle's normal — its front face
 * as modelled, flipped by a mirroring transform, as the bake's emitters face — weighted by area.
 * Null without windows.
 */
export const windowFillDirection = (scene: Object3D): Vector3 | null => {
  const sum = new Vector3()
  const [a, b, c, ab, ac] = [0, 1, 2, 3, 4].map(() => new Vector3()) as Vector3[]
  scene.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || !/^windowGlass\d+$/.test(mesh.name)) return
    mesh.updateWorldMatrix(true, false)
    const flip = mesh.matrixWorld.determinant() < 0 ? -1 : 1
    const pos = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    const count = index ? index.count : pos.count
    const at = (i: number) => (index ? index.getX(i) : i)
    for (let i = 0; i + 2 < count; i += 3) {
      a!.fromBufferAttribute(pos, at(i)).applyMatrix4(mesh.matrixWorld)
      b!.fromBufferAttribute(pos, at(i + 1)).applyMatrix4(mesh.matrixWorld)
      c!.fromBufferAttribute(pos, at(i + 2)).applyMatrix4(mesh.matrixWorld)
      // The cross product's length is twice the area: the sum weighs each triangle by its area.
      sum.addScaledVector(ab!.subVectors(b!, a!).cross(ac!.subVectors(c!, a!)), flip)
    }
  })
  sum.y = 0
  return sum.lengthSq() > 1e-8 ? sum.normalize() : null
}

/**
 * The fill as SH coefficients (normalized: 1 on every wall): E(n) = A + k·(3y² − 1) + m·y − t·(n·d)
 * gives every wall (y = 0) 1 − t·(n·d), the ceiling (y = −1) 1, the floor (y = 1) `floor` — written
 * in this basis's terms (`SOFT_FILL_GLSL`: 3y² − 1 = −½(3z² − 1) − 3/2(x² − y²)); `d`, where the
 * daylight travels (a surface facing the window has n·d = −1).
 */
const evenSH = (floor: number, tilt: number, d: Vector3 | null): number[] => {
  const m = (floor - 1) / 2
  const k = (floor - 1) / 6
  const a = 1 + k
  const sh = new Array<number>(9).fill(0)
  sh[0] = a / 0.282095
  sh[1] = m / 0.488603
  sh[6] = -k / 2 / 0.315392
  sh[8] = (-1.5 * k) / 0.546274
  if (d && tilt > 0) {
    sh[2] = (-tilt * d.z) / 0.488603
    sh[3] = (-tilt * d.x) / 0.488603
  }
  return sh
}

/** The fill's 9 coefficients (three units of irradiance, white), shared by every patched shader. */
const FILL_SH = { value: Array.from({ length: 9 }, () => new Vector3()) }

/**
 * AR-169 trial (`?fillnear=1`, `fillField.ts`): each surface's own window direction. While a field
 * is set the tilt leaves the coefficients and the shader adds it per surface — `fillLean`, the
 * tilt's strength, × the surface's facing against the field's direction where it stands.
 */
const FILL_FIELD = {
  fillLeanField: { value: null as Texture | null },
  fillLeanBounds: { value: new Vector4() },
  fillLean: { value: new Vector3() },
  fillLeanNear: { value: false },
}

let field: FillField | null = null

let fillShare = 1

/**
 * The artist's share of the fill (AR-169, `fillLightLevel`, 0–2): set in place, so every shader
 * holding `FILL_SH` shows it on the next frame — no re-bake, nothing recompiled.
 */
export const setSoftFillLevel = (share: number) => {
  fillShare = share
  const scale = (fillLux() * share) / LUX_PER_UNIT
  FILL_FIELD.fillLeanNear.value = field !== null
  FILL_FIELD.fillLean.value.setScalar(field ? fillTilt() * scale : 0)
  evenSH(floorShare(), fillTilt(), field ? null : windowDirection).forEach((c, k) =>
    FILL_SH.value[k]!.setScalar(c * scale),
  )
}

/** The room's daylight direction (`windowFillDirection`), or null: the fill follows at once. */
export const setFillDirection = (direction: Vector3 | null) => {
  windowDirection = direction
  setSoftFillLevel(fillShare)
}
setSoftFillLevel(1)

/** AR-169 trial: the room's field of window directions (`windowFillField`), or null to drop it. */
export const setFillField = (next: FillField | null) => {
  if (next === field) return
  field?.texture.dispose()
  field = next
  FILL_FIELD.fillLeanField.value = next?.texture ?? null
  if (next) FILL_FIELD.fillLeanBounds.value.copy(next.bounds)
  setSoftFillLevel(fillShare)
}

/** GLSL: the fill's irradiance for a world-space normal. */
const SOFT_FILL_GLSL = /* glsl */ `
uniform vec3 fillSH[ 9 ];
vec3 softFill( vec3 n ) {
  return fillSH[ 0 ] * 0.282095
    + fillSH[ 1 ] * ( 0.488603 * n.y ) + fillSH[ 2 ] * ( 0.488603 * n.z ) + fillSH[ 3 ] * ( 0.488603 * n.x )
    + fillSH[ 4 ] * ( 1.092548 * n.x * n.y ) + fillSH[ 5 ] * ( 1.092548 * n.y * n.z )
    + fillSH[ 6 ] * ( 0.315392 * ( 3.0 * n.z * n.z - 1.0 ) )
    + fillSH[ 7 ] * ( 1.092548 * n.x * n.z ) + fillSH[ 8 ] * ( 0.546274 * ( n.x * n.x - n.y * n.y ) );
}
`

/** The term the bake's shaders add after the lightmap's light. */
const SOFT_FILL_TERM =
  'irradiance += softFill( inverseTransformDirection( geometryNormal, viewMatrix ) );'

/**
 * AR-169 trial (`?fillnear=1`): the field's uniforms, and the term with the per-surface tilt — read
 * where the surface stands, 0.4 m out along its facing (a wall reads its own room, not the one
 * behind it). Without a field (`fillLeanNear` false) it is `SOFT_FILL_TERM`'s light, nothing added.
 */
const FILL_NEAR_GLSL = /* glsl */ `
uniform sampler2D fillLeanField;
uniform vec4 fillLeanBounds;
uniform vec3 fillLean;
uniform bool fillLeanNear;
`
const FILL_NEAR_TERM = /* glsl */ `vec3 softFillNormal = inverseTransformDirection( geometryNormal, viewMatrix );
irradiance += softFill( softFillNormal );
if ( fillLeanNear ) {
  vec3 softFillAt = ( vec4( - vViewPosition, 0.0 ) * viewMatrix ).xyz + cameraPosition;
  vec2 softFillUv = ( softFillAt.xz + softFillNormal.xz * 0.4 - fillLeanBounds.xy ) * fillLeanBounds.zw;
  irradiance -= fillLean * dot( softFillNormal.xz, texture2D( fillLeanField, softFillUv ).xy );
}`

/** The fill's GLSL for a patched shader: `SOFT_FILL_GLSL`, with the field's uniforms on its trial. */
export const softFillGlsl = (): string =>
  fillNearFlag() ? `${SOFT_FILL_GLSL}${FILL_NEAR_GLSL}` : SOFT_FILL_GLSL

/** The fill's term for a patched shader: `SOFT_FILL_TERM`, or the per-surface one on its trial. */
export const softFillTerm = (): string => (fillNearFlag() ? FILL_NEAR_TERM : SOFT_FILL_TERM)

/** The fill's uniforms for a patched shader (the field's too, on its trial). */
export const softFillUniforms = () =>
  fillNearFlag() ? { fillSH: FILL_SH, ...FILL_FIELD } : { fillSH: FILL_SH }
