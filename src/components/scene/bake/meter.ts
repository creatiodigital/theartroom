import { Color, Matrix3, Vector3 } from 'three'
import type { Mesh, Object3D, SpotLight } from 'three'

import { spaceLooks, type SpaceCamera } from '@/lib/bake/spaceLooks'

import { CAMERA_EXPOSURE, LUX_PER_UNIT } from './bakedLook'
import type { LightBaker } from './LightBaker'

/**
 * Expose for the art. Khronos PBR Neutral is the identity below 0.76 (0.8 − 0.04) and only
 * compresses above it, so a print whose paper white lands at 0.76 shows its file's colours
 * unchanged. Paper white ≈ 0.85 reflectance.
 */
const ART_WHITE_TARGET = 0.76
const PAPER_ALBEDO = 0.85

/**
 * three's SpotLight irradiance at a point (physically correct mode), no shadow, in RGB. Only from
 * the front: a lamp behind the surface (the far side of a freestanding wall) lights the other face.
 */
export const spotIrradiance = (light: SpotLight, point: Vector3, normal: Vector3): Color => {
  const position = new Vector3().setFromMatrixPosition(light.matrixWorld)
  const target = new Vector3().setFromMatrixPosition(light.target.matrixWorld)
  const toLight = position.clone().sub(point)
  const d = toLight.length()
  const L = toLight.divideScalar(d)
  const axis = target.sub(position).normalize()
  const coneCos = Math.cos(light.angle)
  const penumbraCos = Math.cos(light.angle * (1 - light.penumbra))
  const x = Math.min(
    1,
    Math.max(0, (L.clone().negate().dot(axis) - coneCos) / (penumbraCos - coneCos)),
  )
  const spot = x * x * (3 - 2 * x)
  let falloff = 1 / Math.max(Math.pow(d, light.decay), 0.01)
  if (light.distance > 0) {
    const r = Math.min(1, Math.max(0, 1 - Math.pow(d / light.distance, 4)))
    falloff *= r * r
  }
  return light.color
    .clone()
    .multiplyScalar(light.intensity * spot * falloff * Math.max(normal.dot(L), 0))
}

export const luminance = (c: Color) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722

/** Diagnostics: mean irradiance (lamps direct + room bounce) on every artwork, with its place. */
export const artworkIrradiances = (scene: Object3D, bounce: Color) => {
  const lights: SpotLight[] = []
  const works: Mesh[] = []
  scene.traverse((o) => {
    const light = o as SpotLight
    if (light.isSpotLight && light.visible && light.intensity > 0) lights.push(light)
    if ((o as Mesh).isMesh && o.name === 'artworkImage') works.push(o as Mesh)
  })
  return works.map((work) => {
    work.updateMatrixWorld(true)
    work.geometry.computeBoundingBox()
    const box = work.geometry.boundingBox!
    const normal = new Vector3(0, 0, 1)
      .applyMatrix3(new Matrix3().getNormalMatrix(work.matrixWorld))
      .normalize()
    let sum = 0
    for (const u of [0.1, 0.5, 0.9]) {
      for (const v of [0.1, 0.5, 0.9]) {
        const point = new Vector3(
          box.min.x + (box.max.x - box.min.x) * u,
          box.min.y + (box.max.y - box.min.y) * v,
          0,
        ).applyMatrix4(work.matrixWorld)
        sum += luminance(
          lights.reduce((e, l) => e.add(spotIrradiance(l, point, normal)), bounce.clone()),
        )
      }
    }
    const centre = new Vector3()
    box.getCenter(centre).applyMatrix4(work.matrixWorld)
    return {
      at: centre.toArray().map((n) => +n.toFixed(2)),
      normal: normal.toArray().map((n) => +n.toFixed(1)),
      lux: Math.round((sum / 9) * LUX_PER_UNIT),
    }
  })
}

/**
 * The light on the brightest-lit artwork: every mounted lamp's direct light at 9 points across
 * each work, plus the room's bounce light (`bounce`, RGB — the lamps' direct light is summed
 * here, not in it). Its level sets the camera guard; its colour is the grey card a photographer
 * would white-balance on, so the art — not the lamp — reads neutral.
 *
 * `bounceAt`: the daylight + bounce MEASURED at a work, used instead of the room-average
 * `bounce`. In a brightly lit room the average undercounts what reaches the
 * art, the camera does not stop down enough, and near-white prints burn.
 */
const brightestArtworkLight = (
  scene: Object3D,
  bounce: Color,
  bounceAt?: (work: Mesh) => Color | undefined,
): Color | null => {
  const lights: SpotLight[] = []
  const works: Mesh[] = []
  scene.traverse((o) => {
    const light = o as SpotLight
    if (light.isSpotLight && light.visible && light.intensity > 0) lights.push(light)
    if ((o as Mesh).isMesh && o.name === 'artworkImage') works.push(o as Mesh)
  })
  let brightest: Color | null = null
  for (const work of works) {
    work.updateMatrixWorld(true)
    work.geometry.computeBoundingBox()
    const box = work.geometry.boundingBox!
    const normal = new Vector3(0, 0, 1)
      .applyMatrix3(new Matrix3().getNormalMatrix(work.matrixWorld))
      .normalize()
    for (const u of [0.1, 0.5, 0.9]) {
      for (const v of [0.1, 0.5, 0.9]) {
        const point = new Vector3(
          box.min.x + (box.max.x - box.min.x) * u,
          box.min.y + (box.max.y - box.min.y) * v,
          0,
        ).applyMatrix4(work.matrixWorld)
        const E = lights.reduce(
          (sum, l) => sum.add(spotIrradiance(l, point, normal)),
          (bounceAt?.(work) ?? bounce).clone(),
        )
        if (!brightest || luminance(E) > luminance(brightest)) brightest = E
      }
    }
  }
  return brightest
}

/**
 * The space's fixed camera (exposure + white balance), from `spaceLooks`. Throws for a space
 * without one — only baked spaces bake.
 */
export const bakeCamera = (spaceId: string): SpaceCamera => {
  const camera = spaceLooks[spaceId]?.camera
  if (!camera) throw new Error(`Space "${spaceId}" has no fixed camera`)
  return camera
}

export interface BakeMeter {
  artPeakLux: number
  /** Paper white (radiance) at the metered exposure. */
  paperWhite: number
  meteredExposure: number
  // For the `[AR-161 meter]` line.
  /** The light on the brightest-lit artwork (null: no artwork). */
  artLight: Color | null
  /** The room's mean bounce on the walls (RGB, three units). */
  bounce: Color
  /** Raw readings, three units: artwork peak, paper radiance, wall and ceiling medians. */
  artPeak: number
  paperRadiance: number
  wallMedian: number
  ceilingMedian: number
}

/**
 * Diagnostics only — it never sets the camera. What a photographer's meter would read off the
 * finished bake: the brightest artwork's light, and the exposure that would put its paper
 * white at `ART_WHITE_TARGET` (stopped DOWN only, never brightened). `artBounce`: the bounce
 * measured at each work (the room average otherwise).
 */
export const meterBake = (
  baker: LightBaker,
  scene: Object3D,
  artBounce?: Map<Mesh, Color>,
): BakeMeter => {
  const bounce = baker.bounceColor('wall')
  const artLight = brightestArtworkLight(scene, bounce, (work) => artBounce?.get(work))
  // Rooms with no artwork fall back to the brightest wall.
  const artPeak = artLight ? luminance(artLight) : 0
  const peak = artPeak > 0 ? artPeak : baker.percentileIrradiance('wall', 0.97)
  const paperRadiance = (PAPER_ALBEDO * peak) / Math.PI
  const guard = paperRadiance > 0 ? ART_WHITE_TARGET / paperRadiance : CAMERA_EXPOSURE
  const meteredExposure = Math.min(CAMERA_EXPOSURE, guard)
  return {
    artPeakLux: Math.round(artPeak * LUX_PER_UNIT),
    paperWhite: paperRadiance * meteredExposure,
    meteredExposure,
    artLight,
    bounce,
    artPeak,
    paperRadiance,
    wallMedian: baker.percentileIrradiance('wall', 0.5),
    ceilingMedian: baker.percentileIrradiance('ceiling', 0.5),
  }
}
