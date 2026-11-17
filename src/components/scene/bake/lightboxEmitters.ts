import { Color, Matrix4, Mesh, type Material, type Object3D, type Texture } from 'three'

import { artworkDisplayOf, artworkIdOf } from '@/components/scene/spaces/objects/Display/artworkId'
import { imageMeanColor, luminanceOf } from '@/components/scene/spaces/objects/Lightbox/imageMean'

import { isWorldVisible } from './daylight'
import type { AreaEmitter } from './LightBaker'

/**
 * ⚠️ AR-183 — a lightbox's front in the bake (docs/lightbox §5): an area emitter, as window glass
 * is (`brightenWindows`), so the bake puts its light on what faces it: the floor below, the works
 * and walls across. Its own glow stays live (the front's shader, bloom, the wash beside it on its
 * own wall, which the front never faces): only its light on the room is baked.
 *
 * The front's radiance is the panel's light (`lightboxPanel`: 10–20× a lit wall, tuning round 1)
 * in the light's color × what the film lets through (the image's mean), in the room's units — a
 * real light, not what the screen can show of it (the screen tops out at white).
 */

/**
 * The emitter sits this far in front of the image: a ray from the room meets its light before the
 * image's own (black) surface, and its samples (`EMITTER_OFFSET` further out) are clear of the box.
 */
const FRONT_OFFSET = 0.0005

/** Samples per lightbox: a sixteenth of the windows' budget (256 at full quality, 64 quick). */
export const lightboxVpls = (emitterVpls: number): number =>
  Math.max(32, Math.round(emitterVpls / 16))

/** The share of light the film lets through: its image's mean linear luminance (0.5 unread). */
const filmTransmission = (map: Texture | null | undefined): number => {
  const mean = imageMeanColor(map?.image)
  return mean ? luminanceOf(mean) : 0.5
}

/** The key `Display` writes on a lightbox's display group (`lightboxBakeKey`). */
export const LIGHTBOX_BAKE_KEY = 'lightboxBakeKey'

/**
 * Every lightbox front the room shows, as an area emitter, and what each was baked as
 * (artwork id → `lightboxBakeKey`) for the bake record: a front whose key no longer matches
 * keeps its fallback glow (`Display`).
 */
export const lightboxEmitters = (
  scene: Object3D,
  vpls: number,
): { emitters: AreaEmitter[]; baked: Record<string, string> } => {
  const emitters: AreaEmitter[] = []
  const baked: Record<string, string> = {}
  scene.updateMatrixWorld(true)
  scene.traverse((o) => {
    const image = o as Mesh
    const material = image.material as
      | (Material & {
          map?: Texture | null
          userData: { lightboxPanel?: number; lightboxColor?: [number, number, number] }
        })
      | undefined
    // A lightbox's front says its panel's light and the light's color (`LightboxSurface`): the
    // light's FULL color — the picture on screen takes only a little of it.
    const panel = material?.userData?.lightboxPanel
    const color = material?.userData?.lightboxColor
    if (!image.isMesh || image.name !== 'artworkImage' || typeof panel !== 'number' || !color)
      return
    if (!isWorldVisible(image)) return
    const id = artworkIdOf(image)
    const radiance = new Color(...color).multiplyScalar(panel * filmTransmission(material.map))
    if (radiance.r + radiance.g + radiance.b <= 0) return
    // A plane of its own just in front of the image (never added to the scene).
    const front = new Mesh(image.geometry)
    front.name = `lightbox:${id ?? image.uuid}`
    front.matrixAutoUpdate = false
    front.matrix.copy(image.matrixWorld).multiply(new Matrix4().makeTranslation(0, 0, FRONT_OFFSET))
    front.matrixWorld.copy(front.matrix)
    emitters.push({ mesh: front, radiance, vpls })
    const key = artworkDisplayOf(image)?.userData[LIGHTBOX_BAKE_KEY]
    if (id && typeof key === 'string') baked[id] = key
  })
  return { emitters, baked }
}
