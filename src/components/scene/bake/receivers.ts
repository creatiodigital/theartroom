import { Color, Mesh, SRGBColorSpace } from 'three'
import type { Material, MeshStandardMaterial, Object3D, Texture } from 'three'

import { BAKE_SURFACES, type BakeSurface } from '@/lib/bake/bakeRecord'
import type { SpaceLook } from '@/lib/bake/spaceLooks'

import { buildPropAtlas } from './autoUnwrap'
import { BAKE_DEBUG } from './bakedLook'
import { hashUnwrap, unwrapStats } from './hashUnwrap'
import type { BakeReceiver, LightBaker } from './LightBaker'

/**
 * ⚠️ AR-161 — the room's bake receivers, built the same way for the live bake, the admin's
 * review and every visitor: a stored bake's maps fit only the unwrap they were baked into, so
 * one function builds it for all three (and `unwrapHash` says whether stored maps still fit).
 */

/** Meters of wall one plaster texture tile covers. */
const PLASTER_TILE = 0.7 // Eduardo, 2026-10-16: "decrease the size of the map a little" (was 1)

/** Static fixtures baked into one shared atlas: their authored UVs are for tiling. */
const PROP_NAME = /^(windowFrame|windowHandle|radiator|singleSocket|doubleSwitch)\d+$/

/** The ceiling's paint reflectance (its color scales it). */
const CEILING_ALBEDO = 0.85

const averageAlbedo = (texture: Texture | null | undefined): Color => {
  try {
    const image = texture?.image as CanvasImageSource | undefined
    if (!image) return new Color(0.3, 0.3, 0.3)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 16
    const ctx = canvas.getContext('2d')
    if (!ctx) return new Color(0.3, 0.3, 0.3)
    ctx.drawImage(image, 0, 0, 16, 16)
    const data = ctx.getImageData(0, 0, 16, 16).data
    const sum = new Color(0, 0, 0)
    const c = new Color()
    for (let i = 0; i < data.length; i += 4) {
      c.setRGB(data[i]! / 255, data[i + 1]! / 255, data[i + 2]! / 255, SRGBColorSpace)
      sum.add(c)
    }
    return sum.multiplyScalar(1 / 256)
  } catch {
    return new Color(0.3, 0.3, 0.3)
  }
}

export interface PreparedReceivers {
  /** In bake order: a receiver's position is its lightmap index. */
  receivers: BakeReceiver[]
  /**
   * `hashUnwrap` of the `uv1` of the receivers a stored bake carries maps for (`BAKE_SURFACES`),
   * in receiver order. Not the artwork atlas: it has no stored map, and artworks that load late
   * or are hidden must not reject a valid bake.
   */
  unwrapHash: string
  /** `unwrapStats` of the same arrays: the tolerant check for browsers one ulp apart. */
  unwrapStats: number[][]
  /** Puts every mesh's own geometry back. */
  restore: () => void
}

/** The room as a bake takes it: the artist's wall and ceiling colors, and the space's look. */
export interface RoomPaint {
  wall: string
  ceiling: string
  look: SpaceLook
}

/**
 * Walls, ceiling, floor, the artworks (measured only) and the fixtures, as the bake takes them —
 * `room`: the artist's wall and ceiling colors and the space's look (its paint). Every
 * receiver on our own unwrap writes `uv1` on the scene meshes it stands for (its `sources`): the
 * baked maps are read through it. A throw midway puts back the geometry it had already replaced
 * before rethrowing.
 */
export const prepareReceivers = (scene: Object3D, room: RoomPaint): PreparedReceivers => {
  const restores: (() => void)[] = []
  const restore = () => restores.splice(0).forEach((undo) => undo())
  try {
    return buildReceivers(scene, room, restores, restore)
  } catch (error) {
    restore()
    throw error
  }
}

const buildReceivers = (
  scene: Object3D,
  room: RoomPaint,
  restores: (() => void)[],
  restore: () => void,
): PreparedReceivers => {
  // Our own unwrap: writes `uv1` on the meshes, undone by `restore`.
  const unwrap = (meshes: Mesh[], texelSize?: number, maxSize?: number, tileMetres?: number) => {
    const atlas = buildPropAtlas(meshes, texelSize, maxSize, tileMetres)
    restores.push(atlas.restore)
    return atlas
  }
  const wall = scene.getObjectByName('wall0') as Mesh | undefined
  const ceiling = scene.getObjectByName('ceiling') as Mesh | undefined
  const floor = scene.getObjectByName('floor') as Mesh | undefined
  const floorMaterial = floor?.material as MeshStandardMaterial | undefined
  const receivers: BakeReceiver[] = []
  // Plaster walls (Eduardo's maps) on our own unwrap — flat parts at true scale, 3-texel gaps —
  // instead of the model's UVs, whose charts touch: sampling at a chart's edge blended in its
  // neighbour (a daylit window reveal → a bright sliver). Directional: the plaster's relief is
  // shaded by where the light comes from.
  if (wall) {
    const atlas = unwrap([wall], 0.0075, 2048, PLASTER_TILE)
    if (BAKE_DEBUG)
      console.info(
        '[AR-161 wall atlas]',
        JSON.stringify({ size: atlas.size, texelCm: +(atlas.texel * 100).toFixed(2) }),
      )
    receivers.push({
      name: 'wall',
      mesh: new Mesh(atlas.merged),
      size: atlas.size,
      albedo: new Color(room.wall).multiplyScalar(room.look.paintReflectance),
      directional: true,
      sources: [wall],
    })
  }
  if (ceiling) {
    // Plaster on the ceiling too: same unwrap + true-scale tiling + directional bake.
    const atlas = unwrap([ceiling], 0.015, 1024, PLASTER_TILE)
    receivers.push({
      name: 'ceiling',
      mesh: new Mesh(atlas.merged),
      size: atlas.size,
      albedo: new Color(room.ceiling).multiplyScalar(CEILING_ALBEDO),
      smoothBounce: true,
      directional: true,
      sources: [ceiling],
    })
  }
  if (floor && floorMaterial)
    receivers.push({
      name: 'floor',
      mesh: floor,
      size: 1024,
      albedo: averageAlbedo(floorMaterial.map).multiply(floorMaterial.color),
      smoothBounce: true,
    })

  // Artworks: one atlas, measured (daylight + bounce) but not re-emitted, and not given
  // the lamps' light twice (they receive it in realtime).
  const art = shownArtworkImages(scene)
  if (art.length) {
    const atlas = unwrap(art, 0.01, 512)
    receivers.push({
      name: 'art',
      mesh: new Mesh(atlas.merged),
      size: atlas.size,
      albedo: new Color(0.5, 0.5, 0.5),
      noLampDirect: true,
      noEmit: true,
      sources: art,
    })
  }

  // Fixtures: one auto-unwrapped atlas for all of them.
  const props: Mesh[] = []
  scene.traverse((o) => {
    const m = o as Mesh
    if (m.isMesh && PROP_NAME.test(m.name) && m.visible) props.push(m)
  })
  if (props.length) {
    const atlas = unwrap(props)
    if (BAKE_DEBUG)
      console.info(
        '[AR-161 props atlas]',
        JSON.stringify({
          size: atlas.size,
          texelCm: +(atlas.texel * 100).toFixed(2),
          props: props.length,
        }),
      )
    const albedo = props
      .reduce(
        (sum, p) => sum.add((p.material as MeshStandardMaterial).color ?? new Color(0.7, 0.7, 0.7)),
        new Color(0, 0, 0),
      )
      .multiplyScalar(1 / props.length)
    receivers.push({
      name: 'props',
      mesh: new Mesh(atlas.merged),
      size: atlas.size,
      albedo,
      sources: props,
    })
  }

  // A receiver on our own unwrap stands for its `sources`: their `uv1` is the layout its map
  // is read through (the floor keeps its own UVs: no sources).
  const unwraps = receivers
    .filter((r) => BAKE_SURFACES.includes(r.name as BakeSurface))
    .flatMap((r) => r.sources ?? [])
    .map((m) => (m as Mesh).geometry.getAttribute('uv1').array as Float32Array)
  return { receivers, unwrapHash: hashUnwrap(unwraps), unwrapStats: unwrapStats(unwraps), restore }
}

/** The artwork images the room shows (both shown and with a shown material), in scene order. */
export const shownArtworkImages = (scene: Object3D): Mesh[] => {
  const images: Mesh[] = []
  scene.traverse((o) => {
    const m = o as Mesh
    if (m.isMesh && m.name === 'artworkImage' && m.visible && (m.material as Material).visible)
      images.push(m)
  })
  return images
}

/** The artwork images the bake measures (the `art` receiver's meshes; none without it). */
export const artworkImages = (receivers: BakeReceiver[]): Mesh[] =>
  (receivers.find((r) => r.name === 'art')?.sources ?? []) as Mesh[]

/**
 * The daylight + bounce a finished bake measured at each artwork — what `applyBakedLighting` puts
 * on its mat, frame and text card.
 */
export const measureArtLight = (baker: LightBaker, receivers: BakeReceiver[]) => {
  const light = new Map<Mesh, Color>()
  for (const image of artworkImages(receivers)) {
    image.updateMatrixWorld(true)
    image.geometry.computeBoundingBox()
    const box = image.geometry.boundingBox!.clone().applyMatrix4(image.matrixWorld)
    light.set(image, baker.meanIrradianceIn('art', box))
  }
  return light
}
