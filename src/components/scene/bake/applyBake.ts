import {
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  ShaderChunk,
  Vector3,
} from 'three'
import type { Material, Mesh, Object3D, Texture, WebGLRenderer } from 'three'

import { assetUrl } from '@/lib/assetUrl'
import type { BakeMapKind, BakeSurface } from '@/lib/bake/bakeRecord'
import { artworkDisplayOf, artworkIdOf } from '@/components/scene/spaces/objects/Display/artworkId'

import { BAKE_DEBUG } from './bakedLook'
import type { BakeReceiver } from './LightBaker'
import { shownArtworkImages } from './receivers'

/**
 * ⚠️ AR-161 — the baked light onto the room, the same way whether the maps come from the bake
 * that just finished or from a stored bake (review, visitors):
 *
 * - walls / ceiling → MeshBasicMaterial(albedo, lightMap): they no longer evaluate ANY realtime
 *   light (the per-pixel 22-lamp loop on full-screen walls was the scene's biggest cost); with
 *   plaster, a matte MeshStandardMaterial whose diffuse light is the bake;
 * - floor → its own material keeps map/normal/roughness as authored and gains the lightmap,
 *   with realtime direct light and environment DIFFUSE switched off (both are in the bake);
 *   its environment SPECULAR stays — that is the floor's glossy reflection;
 * - fixtures and display panels → the same, each through its shared atlas (a panel keeps its
 *   paint; AR-163 — realtime, panels changed brightness as the visitor walked).
 *
 * Artworks and frames stay realtime (lamps); each work's mat, frame and text card also
 * take the daylight + bounce the bake measured at it. The images show their file (`Display`).
 */

/**
 * Wall plaster (Eduardo's maps), tiled at true scale on our own wall unwrap; the color stays the
 * artist's. Served from R2 through `assetUrl`, like the floor sets.
 */
export const PLASTER = {
  normal: assetUrl('/assets/materials/plaster/normal.jpg'),
  roughness: assetUrl('/assets/materials/plaster/roughness.jpg'),
}

export interface PlasterTextures {
  normal: Texture
  roughness: Texture
}

/**
 * The plaster maps as the walls read them: tiled, through `uv2` (the wall unwrap's true-scale plane
 * coordinates), sharp at grazing angles. Set before their first use, by every path that loads them.
 */
export const configurePlaster = (plaster: PlasterTextures, gl: WebGLRenderer): PlasterTextures => {
  for (const t of [plaster.normal, plaster.roughness]) {
    t.wrapS = t.wrapT = RepeatWrapping
    t.anisotropy = gl.capabilities.getMaxAnisotropy()
    t.channel = 2 // uv2: the wall unwrap's true-scale plane coordinates
  }
  return plaster
}

/** One finished map, as a texture: from the live bake, or decoded from a stored one. */
export interface BakedMapTexture {
  receiver: BakeSurface
  kind: BakeMapKind
  texture: Texture
}

/**
 * Floor: keep its PBR maps, take diffuse light ONLY from the bake. (three substitutes light
 * counts into the source as literals — `NUM_SPOT_LIGHTS` becomes `22` — so the loops cannot be
 * #undef'd; zero the direct terms after they run instead.)
 */
const LIGHTS_OFF = `#include <lights_fragment_begin>
  reflectedLight.directDiffuse = vec3(0.0);
  reflectedLight.directSpecular = vec3(0.0);`

/**
 * Matte paint (the display panels): no reflection either. The room capture's sheen depends on
 * where the visitor stands and looks — recaptured as they walk, Fresnel-brightened at grazing
 * angles — and turned a painted panel's color as the camera moved (AR-163). Plain painted walls
 * have none either (`MeshBasicMaterial`).
 */
const REFLECTION_OFF = `#include <lights_fragment_end>
  reflectedLight.indirectSpecular = vec3(0.0);`

/**
 * A Standard material keeps its maps and reflections; its diffuse light comes from the bake (×
 * `intensity`). `matte`: its reflections go too (`REFLECTION_OFF`). Its own shader hooks, if any (a
 * panel's `panelSurface`), give way while the bake is on and come back with the undo.
 */
const patchStandard = (
  material: MeshStandardMaterial,
  lightMap: Texture,
  intensity = 1,
  matte = false,
) => {
  const own = (key: 'onBeforeCompile' | 'customProgramCacheKey') =>
    Object.prototype.hasOwnProperty.call(material, key) ? { value: material[key] } : null
  const before = { compile: own('onBeforeCompile'), cacheKey: own('customProgramCacheKey') }
  material.lightMap = lightMap
  material.lightMapIntensity = intensity
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_fragment_begin>', LIGHTS_OFF)
      .replace(
        '#include <lights_fragment_maps>',
        ShaderChunk.lights_fragment_maps.replace(
          'iblIrradiance += getIBLIrradiance( geometryNormal );',
          '',
        ),
      )
    if (matte)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        REFLECTION_OFF,
      )
  }
  material.customProgramCacheKey = () => `baked-${matte ? 'matte' : 'standard'}-${lightMap.channel}`
  material.needsUpdate = true
  return () => {
    material.lightMap = null
    material.lightMapIntensity = 1
    if (before.compile)
      material.onBeforeCompile = before.compile.value as MeshStandardMaterial['onBeforeCompile']
    else Reflect.deleteProperty(material, 'onBeforeCompile')
    if (before.cacheKey)
      material.customProgramCacheKey = before.cacheKey
        .value as MeshStandardMaterial['customProgramCacheKey']
    else Reflect.deleteProperty(material, 'customProgramCacheKey')
    material.needsUpdate = true
  }
}

/**
 * Plaster walls: the bake's light, shaded by the plaster's normals through the directional
 * lightmap (Unity's encoding): half-Lambert of the PERTURBED normal against the stored direction,
 * divided by the same for the flat surface normal. A flat patch gets exactly the baked light;
 * relief brightens where it faces the light and darkens where it turns away — strongest under
 * grazing light, nothing where the light is soft bounce (directionality ≈ 0).
 */
const patchPlaster = (material: MeshStandardMaterial, lightMap: Texture, direction: Texture) => {
  material.lightMap = lightMap
  material.lightMapIntensity = 1
  material.onBeforeCompile = (shader) => {
    shader.uniforms.bakedDirection = { value: direction }
    shader.fragmentShader = `uniform sampler2D bakedDirection;\n${shader.fragmentShader}`
      .replace('#include <lights_fragment_begin>', LIGHTS_OFF)
      .replace(
        '#include <lights_fragment_maps>',
        ShaderChunk.lights_fragment_maps
          .replace('iblIrradiance += getIBLIrradiance( geometryNormal );', '')
          .replace(
            'irradiance += lightMapIrradiance;',
            `vec3 bakedDir = ( viewMatrix * vec4( texture2D( bakedDirection, vLightMapUv ).xyz, 0.0 ) ).xyz;
            float bakedFlat = dot( nonPerturbedNormal, bakedDir ) + 0.5;
            float bakedRelief = dot( geometryNormal, bakedDir ) + 0.5;
            irradiance += lightMapIrradiance * clamp( bakedRelief / max( bakedFlat, 1e-3 ), 0.0, 2.0 );`,
          ),
      )
  }
  material.customProgramCacheKey = () => `baked-plaster-${lightMap.channel}`
  material.needsUpdate = true
}

/**
 * An artwork's daylight + bounce, measured by the bake AT the artwork, replaces the environment's
 * diffuse — a single snapshot of the room from wherever the visitor
 * stood, which lit identical walls ~10% apart. The lamps' direct light stays realtime; the
 * environment's specular (the paper's faint sheen) stays too.
 */
const patchArtBounce = (material: MeshStandardMaterial, irradiance: Color) => {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.artBounce = { value: irradiance }
    shader.fragmentShader = `uniform vec3 artBounce;\n${shader.fragmentShader}`.replace(
      '#include <lights_fragment_maps>',
      ShaderChunk.lights_fragment_maps
        .replace('iblIrradiance += getIBLIrradiance( geometryNormal );', '')
        .replace(
          '#if defined( RE_IndirectDiffuse )',
          '#if defined( RE_IndirectDiffuse )\n\tirradiance += artBounce;',
        ),
    )
  }
  material.customProgramCacheKey = () => 'baked-art-bounce'
  material.needsUpdate = true
  return () => {
    Reflect.deleteProperty(material, 'onBeforeCompile')
    Reflect.deleteProperty(material, 'customProgramCacheKey')
    material.needsUpdate = true
  }
}

/**
 * The artwork's own parts — image, paper, mat, frame, backing: its `Display` group. (Never "the
 * nearest ancestor with a few parts": a frameless display has too few, and that climbed into the
 * group every artwork shares, so one work's measured light went on its neighbours' mats.)
 */
const artworkGroup = (image: Object3D): Object3D => artworkDisplayOf(image) ?? image.parent ?? image

/** The room with its bake on: `undo` puts everything back. */
export interface BakedRoom {
  undo: () => void
  /**
   * Call every frame while the bake is on: an artwork image that mounts later (a slow download, a
   * remount, a rebuilt material), or a text card, gets the same patches as the rest. Throws only
   * if a patch fails; the room's artworks are then left as they were before the call.
   */
  updateArtworks: () => void
}

/**
 * Swaps the baked light onto the room (`receivers` from `prepareReceivers`, `maps` by receiver
 * and kind). `plaster`: the plaster maps; null → plain baked walls. `artLight`: the daylight +
 * bounce at each artwork image (by artwork id — a stored bake's record), put on its mat, frame and
 * text card (`trackArtworks`). A throw midway puts back what it had swapped before rethrowing, so a
 * room is never left half baked.
 */
export const applyBakedLighting = (
  scene: Object3D,
  receivers: BakeReceiver[],
  maps: BakedMapTexture[],
  plaster: PlasterTextures | null,
  artLight: (work: Mesh) => Color | undefined,
): BakedRoom => {
  const restore: (() => void)[] = []
  const undo = () => restore.splice(0).forEach((step) => step())
  const artworks = trackArtworks(scene, artLight)
  try {
    swapBakedLighting(receivers, maps, plaster, restore)
    restore.push(artworks.undo)
    artworks.update()
  } catch (error) {
    // Never a half-swapped room: put back what was swapped, then let the caller report it.
    undo()
    throw error
  }
  return { undo, updateArtworks: () => void artworks.update() }
}

const swapBakedLighting = (
  receivers: BakeReceiver[],
  maps: BakedMapTexture[],
  plaster: PlasterTextures | null,
  restore: (() => void)[],
) => {
  const mapOf = (receiver: string, kind: BakeMapKind) =>
    maps.find((m) => m.receiver === receiver && m.kind === kind)?.texture ?? null
  receivers.forEach((r) => {
    const lightMap = mapOf(r.name, 'light')
    if (!lightMap) return
    if (r.name === 'floor') {
      restore.push(patchStandard(r.mesh.material as MeshStandardMaterial, lightMap))
      return
    }
    if (r.name === 'props' || r.name === 'panels') {
      // Each keeps its own material (a panel its artist's paint); the bake is its diffuse light.
      // A panel is matte paint: only that light, like the walls — nothing that follows the eye.
      lightMap.channel = 1
      const matte = r.name === 'panels'
      ;(r.sources as Mesh[]).forEach((source) =>
        restore.push(
          patchStandard(
            source.material as MeshStandardMaterial,
            lightMap,
            r.lightMapIntensity,
            matte,
          ),
        ),
      )
      return
    }
    // Walls / ceiling: on our own unwrap the receiver stands for its scene mesh, read via uv1.
    const unwrapped = r.sources?.[0] as Mesh | undefined
    const display = unwrapped ?? r.mesh
    if (display !== r.mesh) lightMap.channel = 1
    const previous = display.material as Material
    // Plaster walls: a matte PBR surface — the bake is its diffuse light, its normal and
    // roughness maps as authored shape the room's reflection (the sheen) on it.
    const plasterMaps = unwrapped ? plaster : null
    let baked: Material
    if (plasterMaps) {
      const standard = new MeshStandardMaterial({
        color: r.albedo,
        normalMap: plasterMaps.normal,
        roughnessMap: plasterMaps.roughness,
        roughness: 1,
        metalness: 0,
        side: DoubleSide,
      })
      const direction = mapOf(r.name, 'direction')
      if (direction) {
        direction.channel = 1
        patchPlaster(standard, lightMap, direction)
      } else patchStandard(standard, lightMap)
      baked = standard
    } else {
      baked = new MeshBasicMaterial({
        color: r.albedo,
        lightMap,
        lightMapIntensity: 1,
        side: DoubleSide,
      })
    }
    display.material = baked
    restore.push(() => {
      display.material = previous
      baked.dispose()
    })
  })
}

/**
 * The artworks' share of the bake, for the images given: each one's measured daylight + bounce on
 * every lit part of its group (paper, mat, frame, backing — the image shows its file and takes no
 * light), and the nearest one's on each text card. Returns the undo; a throw midway undoes and
 * rethrows.
 */
const patchArtworks = (
  images: Mesh[],
  cards: Mesh[],
  artLight: (work: Mesh) => Color | undefined,
): (() => void) => {
  const restore: (() => void)[] = []
  const undo = () => restore.splice(0).forEach((step) => step())
  try {
    const patched = new Set<Material>()
    for (const image of images) {
      const irradiance = artLight(image)
      if (!irradiance) continue
      artworkGroup(image).traverse((o) => {
        const material = (o as Mesh).material as MeshStandardMaterial | undefined
        if (!(o as Mesh).isMesh || !material?.isMeshStandardMaterial || patched.has(material))
          return
        patched.add(material)
        restore.push(patchArtBounce(material, irradiance))
      })
    }
    // Text cards take the same light as the passe-partouts beside them — the bounce measured
    // at their nearest artwork (Eduardo 2026-10-18: only the images ignore the room's light).
    // Left alone they took the room capture's IBL and read whiter (and bluer) than the mats.
    if (images.length) {
      const centres = images.map((image) => image.getWorldPosition(new Vector3()))
      for (const card of cards) {
        const material = card.material as MeshStandardMaterial
        if (patched.has(material)) continue
        const at = card.getWorldPosition(new Vector3())
        let nearest = 0
        centres.forEach((c, k) => {
          if (c.distanceTo(at) < centres[nearest]!.distanceTo(at)) nearest = k
        })
        const irradiance = artLight(images[nearest]!)
        if (!irradiance) continue
        patched.add(material)
        restore.push(patchArtBounce(material, irradiance))
      }
    }
    if (BAKE_DEBUG && images.length)
      console.info(
        '[AR-161 art bounce]',
        JSON.stringify({ works: images.length, materials: patched.size }),
      )
  } catch (error) {
    undo()
    throw error
  }
  return undo
}

/** The artwork images and text cards the room shows now, and what would tell a change apart. */
const shownArtworks = (scene: Object3D) => {
  const images = shownArtworkImages(scene)
  const cards: Mesh[] = []
  scene.traverse((o) => {
    const card = o as Mesh
    const material = card.material as MeshStandardMaterial | undefined
    if (card.isMesh && card.name === 'textCard' && material?.isMeshStandardMaterial)
      cards.push(card)
  })
  // Every mesh and material the patches touch: an image, a mat or a frame that mounts later or
  // gets a new material changes it.
  const parts: (number | string)[] = []
  for (const image of images) {
    parts.push('|')
    artworkGroup(image).traverse((o) => {
      const material = (o as Mesh).material as Material | undefined
      if ((o as Mesh).isMesh && material) parts.push(o.id, material.uuid)
    })
  }
  parts.push('|')
  for (const card of cards) parts.push(card.id, (card.material as Material).uuid)
  return { images, cards, signature: parts.join(',') }
}

/**
 * Keeps `patchArtworks` on whatever artworks the room shows. `update()` (every frame) compares the
 * room with what was patched and, on any change — an image that loaded late, a remount, a
 * rebuilt material, a new card — puts the patches back and applies them afresh to everything
 * shown, exactly as if it had all been there at once. Returns whether it re-patched.
 */
export const trackArtworks = (scene: Object3D, artLight: (work: Mesh) => Color | undefined) => {
  let shown: string | null = null
  let undoPatches: (() => void) | null = null
  const undo = () => {
    undoPatches?.()
    undoPatches = null
    shown = null
  }
  const update = (): boolean => {
    const { images, cards, signature } = shownArtworks(scene)
    if (signature === shown) return false
    undo()
    undoPatches = patchArtworks(images, cards, artLight)
    shown = signature
    return true
  }
  return { update, undo }
}

/** The light measured at each artwork image, as a stored bake keeps it: by artwork id. */
export const artLightRecord = (
  light: Map<Mesh, Color>,
): Record<string, [number, number, number]> => {
  const record: Record<string, [number, number, number]> = {}
  light.forEach((c, image) => {
    const id = artworkIdOf(image)
    if (id) record[id] = [c.r, c.g, c.b]
  })
  return record
}

/** An artwork image's light from such a record (none for a work the bake didn't measure). */
export const artLightById =
  (record: Record<string, [number, number, number]>) =>
  (work: Mesh): Color | undefined => {
    const id = artworkIdOf(work)
    if (!id || !Object.prototype.hasOwnProperty.call(record, id)) return undefined
    const [r, g, b] = record[id]!
    return new Color(r, g, b)
  }
