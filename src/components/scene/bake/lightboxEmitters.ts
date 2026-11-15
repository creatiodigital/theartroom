import { Color, Matrix4, Mesh, type Material, type Object3D, type Texture } from 'three'

import { artworkDisplayOf, artworkIdOf } from '@/components/scene/spaces/objects/Display/artworkId'
import type { LightboxUniforms } from '@/components/scene/spaces/objects/Lightbox/lightboxMaterial'

import { isWorldVisible } from './daylight'
import type { AreaEmitter } from './LightBaker'

/**
 * ⚠️ AR-183 — a lightbox's front in the bake (docs/lightbox §5): an area emitter, as window glass
 * is (`brightenWindows`), so the bake puts its soft wash on the floor below, the walls and the
 * works near it. Its own glow stays live (the front's shader, bloom): only its light on the room
 * is baked.
 *
 * What you see is what lights the room: the front's radiance is what it shows — the light's color
 * × its brightness × what the film lets through (the image's mean) — in the room's units, i.e.
 * ÷ the camera's exposure (the front is shown past the camera, `lightboxMaterial.ts`).
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
  const image = map?.image as CanvasImageSource | undefined
  if (!image || typeof document === 'undefined') return 0.5
  try {
    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return 0.5
    context.drawImage(image, 0, 0, size, size)
    const { data } = context.getImageData(0, 0, size, size)
    const linear = (v: number) => {
      const c = v / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    let sum = 0
    for (let i = 0; i < data.length; i += 4)
      sum +=
        0.2126 * linear(data[i]!) + 0.7152 * linear(data[i + 1]!) + 0.0722 * linear(data[i + 2]!)
    return sum / (size * size)
  } catch {
    return 0.5
  }
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
  exposure: number,
  vpls: number,
): { emitters: AreaEmitter[]; baked: Record<string, string> } => {
  const emitters: AreaEmitter[] = []
  const baked: Record<string, string> = {}
  scene.updateMatrixWorld(true)
  scene.traverse((o) => {
    const image = o as Mesh
    const material = image.material as
      | (Material & { map?: Texture | null; userData: { lightbox?: LightboxUniforms } })
      | undefined
    const uniforms = material?.userData?.lightbox
    if (!image.isMesh || image.name !== 'artworkImage' || !uniforms || !isWorldVisible(image))
      return
    const id = artworkIdOf(image)
    const shown = filmTransmission(material.map)
    const radiance = new Color(...uniforms.lbTint.value.toArray()).multiplyScalar(
      (uniforms.lbGain.value * shown) / Math.max(exposure, 0.05),
    )
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
