'use client'

import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Color,
  DoubleSide,
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  ShaderChunk,
  TextureLoader,
  SRGBColorSpace,
  Vector3,
  type SpotLight,
} from 'three'
import type { Material, Object3D, Texture } from 'three'

import type { RootState } from '@/redux/store'
import { requestRoomRecapture } from '@/components/scene/RoomEnvironmentCapture'

import {
  CAMERA_EXPOSURE,
  LUX_PER_UNIT,
  probeUrlNumber,
  setBakeAllRooms,
  setMeteredExposure,
  setMeteredWhiteBalance,
  useRealismProbe,
} from '@/components/scene/realismProbe'

import { LightBaker, type AreaEmitter, type BakeReceiver } from './LightBaker'
import { buildPropAtlas } from './autoUnwrap'

/**
 * DEBUG A/B (spike): `&ar161plaster=1` — wall plaster (Eduardo's maps), tiled at true scale on
 * our own wall unwrap; the colour stays the artist's. Served from the app origin for the spike
 * (ships via R2 + assetUrl like the floor sets).
 */
const PLASTER = {
  normal: '/assets/materials/plaster/normal.jpg',
  roughness: '/assets/materials/plaster/roughness.jpg',
}
/** Metres of wall one texture tile covers. */
const PLASTER_TILE = 0.7 // Eduardo, 2026-10-16: "decrease the size of the map a little" (was 1)

/** Static fixtures baked into one shared atlas: their authored UVs are for tiling. */
const PROP_NAME = /^(windowFrame|windowHandle|radiator|singleSocket|doubleSwitch)\d+$/

/**
 * ⚠️ AR-161 SPIKE — runs `LightBaker` once the room has settled, spread across frames, then
 * swaps the baked light onto the static surfaces:
 *
 * - walls / ceiling → MeshBasicMaterial(albedo, lightMap): they no longer evaluate ANY realtime
 *   light (the per-pixel 22-lamp loop on full-screen walls was the scene's biggest cost);
 * - floor → its own material keeps map/normal/roughness as authored and gains the lightmap,
 *   with realtime direct light and environment DIFFUSE switched off (both are in the bake);
 *   its environment SPECULAR stays — that is the floor's glossy reflection.
 *
 * Artworks, frames and panels stay realtime (lamps + captured room bounce).
 */

/** Seconds after mount before baking: room, floor set and artworks have streamed in. */
const START_DELAY = 4
/** Milliseconds of bake work per frame. */
const FRAME_BUDGET = 24
/**
 * Frames to let every room's lamps mount before gathering them: React commits the spotlights,
 * then the track spots' effects attach their aim targets.
 */
const LAMP_MOUNT_FRAMES = 3

/**
 * Expose for the art. Khronos PBR Neutral is the identity below 0.76 (0.8 − 0.04) and only
 * compresses above it, so a print whose paper white lands at 0.76 shows its file's colours
 * unchanged. Paper white ≈ 0.85 reflectance.
 */
const ART_WHITE_TARGET = 0.76
const PAPER_ALBEDO = 0.85

/** three's SpotLight irradiance at a point (physically correct mode), no shadow, in RGB. */
const spotIrradiance = (light: SpotLight, point: Vector3, normal: Vector3): Color => {
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
    .multiplyScalar(light.intensity * spot * falloff * Math.abs(normal.dot(L)))
}

const luminance = (c: Color) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722

/** Diagnostics: mean irradiance (lamps direct + room bounce) on every artwork, with its place. */
const artworkIrradiances = (scene: Object3D, bounce: Color) => {
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
 */
const brightestArtworkLight = (scene: Object3D, bounce: Color): Color | null => {
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
          bounce.clone(),
        )
        if (!brightest || luminance(E) > luminance(brightest)) brightest = E
      }
    }
  }
  return brightest
}

// White paint's reflectance. DEBUG A/B (spike): `&ar161paint=<reflectance>`.
const WALL_ALBEDO = probeUrlNumber('ar161paint') ?? 0.8
/**
 * Daylight: window glass emits 6× its stored display value into the room (Eduardo's pick,
 * 2026-10-16, from 25 / 12 / 6 — 25 is roughly clear glass under an overcast sky; 6 reads as a
 * filtered gallery window). DEBUG A/B (spike): `&ar161daylight=<gain>` overrides it.
 */
const DAYLIGHT_GAIN = (() => {
  if (typeof window === 'undefined') return 6
  const value = Number(new URLSearchParams(window.location.search).get('ar161daylight'))
  return value > 0 ? value : 6
})()
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

/**
 * Floor: keep its PBR maps, take diffuse light ONLY from the bake. (three substitutes light
 * counts into the source as literals — `NUM_SPOT_LIGHTS` becomes `22` — so the loops cannot be
 * #undef'd; zero the direct terms after they run instead.)
 */
const LIGHTS_OFF = `#include <lights_fragment_begin>
  reflectedLight.directDiffuse = vec3(0.0);
  reflectedLight.directSpecular = vec3(0.0);`

/** A Standard material keeps its maps and reflections; its diffuse light comes from the bake. */
const patchStandard = (material: MeshStandardMaterial, lightMap: Texture) => {
  material.lightMap = lightMap
  material.lightMapIntensity = 1
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
  }
  material.customProgramCacheKey = () => `ar161-baked-standard-${lightMap.channel}`
  material.needsUpdate = true
  return () => {
    material.lightMap = null
    Reflect.deleteProperty(material, 'onBeforeCompile')
    Reflect.deleteProperty(material, 'customProgramCacheKey')
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
    shader.uniforms.ar161Direction = { value: direction }
    shader.fragmentShader = `uniform sampler2D ar161Direction;\n${shader.fragmentShader}`
      .replace('#include <lights_fragment_begin>', LIGHTS_OFF)
      .replace(
        '#include <lights_fragment_maps>',
        ShaderChunk.lights_fragment_maps
          .replace('iblIrradiance += getIBLIrradiance( geometryNormal );', '')
          .replace(
            'irradiance += lightMapIrradiance;',
            `vec3 ar161D = ( viewMatrix * vec4( texture2D( ar161Direction, vLightMapUv ).xyz, 0.0 ) ).xyz;
            float ar161Flat = dot( nonPerturbedNormal, ar161D ) + 0.5;
            float ar161Relief = dot( geometryNormal, ar161D ) + 0.5;
            irradiance += lightMapIrradiance * clamp( ar161Relief / max( ar161Flat, 1e-3 ), 0.0, 2.0 );`,
          ),
      )
  }
  material.customProgramCacheKey = () => `ar161-plaster-${lightMap.channel}`
  material.needsUpdate = true
}

/**
 * An artwork's daylight + bounce, measured by the bake AT the artwork (`&ar161artbounce=1`),
 * replaces the environment's diffuse — a single snapshot of the room from wherever the visitor
 * stood, which lit identical walls ~10% apart. The lamps' direct light stays realtime; the
 * environment's specular (the paper's faint sheen) stays too.
 */
const patchArtBounce = (material: MeshStandardMaterial, irradiance: Color) => {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.ar161ArtBounce = { value: irradiance }
    shader.fragmentShader = `uniform vec3 ar161ArtBounce;\n${shader.fragmentShader}`.replace(
      '#include <lights_fragment_maps>',
      ShaderChunk.lights_fragment_maps
        .replace('iblIrradiance += getIBLIrradiance( geometryNormal );', '')
        .replace(
          '#if defined( RE_IndirectDiffuse )',
          '#if defined( RE_IndirectDiffuse )\n\tirradiance += ar161ArtBounce;',
        ),
    )
  }
  material.customProgramCacheKey = () => 'ar161-art-bounce'
  material.needsUpdate = true
  return () => {
    Reflect.deleteProperty(material, 'onBeforeCompile')
    Reflect.deleteProperty(material, 'customProgramCacheKey')
    material.needsUpdate = true
  }
}

/** The artwork's own group (image, mat, frame, backing): the nearest ancestor with ≥ 3 parts. */
const artworkGroup = (image: Object3D): Object3D => {
  let g: Object3D = image.parent ?? image
  for (let i = 0; i < 4 && g.parent && g.children.length < 3; i++) g = g.parent
  return g
}

export const LoadTimeBake = () => {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const wallColor = useSelector((state: RootState) => state.exhibition.wallColor ?? '#ffffff')
  const ceilingColor = useSelector((state: RootState) => state.exhibition.ceilingColor ?? '#ffffff')
  const { daylight, autoExposure, ceilingWash, whiteBalance } = useRealismProbe()

  const job = useRef<{
    elapsed: number
    baker: LightBaker | null
    run: Generator<void, void, void> | null
    restore: (() => void)[]
    props: Mesh[]
    /** Artwork images whose light is measured by the bake (`&ar161artbounce=1`). */
    art: Mesh[]
    mountFrames: number
    /** Scene meshes (by receiver name) whose lightmap uses our own unwrap (uv1), not their UVs. */
    unwrapped: Record<string, Mesh>
    plaster: { normal: Texture; roughness: Texture } | null
  }>({
    elapsed: 0,
    baker: null,
    run: null,
    restore: [],
    props: [],
    art: [],
    mountFrames: 0,
    unwrapped: {},
    plaster: null,
  })

  useEffect(() => {
    if (!window.location.search.includes('ar161plaster=1')) return
    let cancelled = false
    const current = job.current
    const loader = new TextureLoader()
    Promise.all([loader.loadAsync(PLASTER.normal), loader.loadAsync(PLASTER.roughness)])
      .then(([normal, roughness]) => {
        if (cancelled) return
        for (const t of [normal, roughness]) {
          t.wrapS = t.wrapT = RepeatWrapping
          t.anisotropy = gl.capabilities.getMaxAnisotropy()
          t.channel = 2 // uv2: the wall unwrap's true-scale plane coordinates
        }
        current.plaster = { normal, roughness }
      })
      .catch((error) => console.warn('[AR-161 plaster] could not load', error))
    return () => {
      cancelled = true
      current.plaster?.normal.dispose()
      current.plaster?.roughness.dispose()
      current.plaster = null
    }
  }, [gl])

  useEffect(() => {
    const current = job.current
    return () => {
      current.restore.forEach((undo) => undo())
      current.baker?.dispose()
      current.baker = null
      current.run = null
      current.restore = []
      current.elapsed = 0
      current.mountFrames = 0
      current.unwrapped = {}
      setBakeAllRooms(false)
    }
  }, [gl, scene])

  useFrame((_, delta) => {
    const j = job.current
    j.elapsed += delta

    if (!j.baker) {
      if (j.elapsed < START_DELAY) return
      // Multi-room spaces cull the other rooms' lamps; the bake needs all of them.
      if (j.mountFrames === 0) setBakeAllRooms(true)
      if (j.mountFrames++ < LAMP_MOUNT_FRAMES) return
      const wall = scene.getObjectByName('wall0') as Mesh | undefined
      const ceiling = scene.getObjectByName('ceiling') as Mesh | undefined
      const floor = scene.getObjectByName('floor') as Mesh | undefined
      const floorMaterial = floor?.material as MeshStandardMaterial | undefined
      const receivers: BakeReceiver[] = []
      // DEBUG A/B (spike): `&ar161unwrap=1` bakes the walls into our own unwrap — flat parts at
      // true scale, 3-texel gaps — instead of the model's UVs, whose charts touch: sampling at
      // a chart's edge blended in its neighbour (a daylit window reveal → a bright sliver).
      const plasterWalls = window.location.search.includes('ar161plaster=1')
      const unwrapWalls = plasterWalls || window.location.search.includes('ar161unwrap=1')
      if (wall && unwrapWalls) {
        const atlas = buildPropAtlas([wall], 0.0075, 2048, plasterWalls ? PLASTER_TILE : undefined)
        j.restore.push(atlas.restore)
        j.unwrapped.wall = wall
        console.info(
          '[AR-161 wall atlas]',
          JSON.stringify({ size: atlas.size, texelCm: +(atlas.texel * 100).toFixed(2) }),
        )
        receivers.push({
          name: 'wall',
          mesh: new Mesh(atlas.merged),
          size: atlas.size,
          albedo: new Color(wallColor).multiplyScalar(WALL_ALBEDO),
          directional: plasterWalls,
          sources: [wall],
        })
      } else if (wall)
        receivers.push({
          name: 'wall',
          mesh: wall,
          size: 1024,
          albedo: new Color(wallColor).multiplyScalar(WALL_ALBEDO),
        })
      if (ceiling && plasterWalls) {
        // Plaster on the ceiling too: same unwrap + true-scale tiling + directional bake.
        const atlas = buildPropAtlas([ceiling], 0.015, 1024, PLASTER_TILE)
        j.restore.push(atlas.restore)
        j.unwrapped.ceiling = ceiling
        receivers.push({
          name: 'ceiling',
          mesh: new Mesh(atlas.merged),
          size: atlas.size,
          albedo: new Color(ceilingColor).multiplyScalar(CEILING_ALBEDO),
          smoothBounce: true,
          directional: true,
          sources: [ceiling],
        })
      } else if (ceiling)
        receivers.push({
          name: 'ceiling',
          mesh: ceiling,
          size: 512,
          albedo: new Color(ceilingColor).multiplyScalar(CEILING_ALBEDO),
          smoothBounce: true,
        })
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
      if (window.location.search.includes('ar161artbounce=1')) {
        const art: Mesh[] = []
        scene.traverse((o) => {
          const m = o as Mesh
          if (
            m.isMesh &&
            m.name === 'artworkImage' &&
            m.visible &&
            (m.material as Material).visible
          )
            art.push(m)
        })
        if (art.length) {
          const atlas = buildPropAtlas(art, 0.01, 512)
          j.restore.push(atlas.restore)
          j.art = art
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
      }

      // Fixtures: one auto-unwrapped atlas for all of them.
      const props: Mesh[] = []
      scene.traverse((o) => {
        const m = o as Mesh
        if (m.isMesh && PROP_NAME.test(m.name) && m.visible) props.push(m)
      })
      if (props.length) {
        const atlas = buildPropAtlas(props)
        console.info(
          '[AR-161 props atlas]',
          JSON.stringify({
            size: atlas.size,
            texelCm: +(atlas.texel * 100).toFixed(2),
            props: props.length,
          }),
        )
        j.restore.push(atlas.restore)
        j.props = props
        const albedo = props
          .reduce(
            (sum, p) =>
              sum.add((p.material as MeshStandardMaterial).color ?? new Color(0.7, 0.7, 0.7)),
            new Color(0, 0, 0),
          )
          .multiplyScalar(1 / props.length)
        // DEBUG A/B (spike): `&ar161propsbounce=1` bakes the props' bounce at full resolution.
        const fullResBounce = window.location.search.includes('ar161propsbounce=1')
        receivers.push({
          name: 'props',
          mesh: new Mesh(atlas.merged),
          size: atlas.size,
          albedo,
          fullResBounce,
          sources: props,
        })
      }

      // EXPERIMENT: daylight — visible window glass emits what it shows.
      const emitters: AreaEmitter[] = []
      if (daylight) {
        scene.traverse((o) => {
          const m = o as Mesh
          const material = m.material as MeshStandardMaterial | undefined
          if (!m.isMesh || !/^windowGlass\d+$/.test(m.name) || !material?.visible || !m.visible)
            return
          // The glass shows the sky; give it the sky's physical brightness — a window is far
          // brighter than any lamp — and emit exactly what it shows into the room.
          const previous = material.emissiveIntensity
          material.emissiveIntensity = previous * DAYLIGHT_GAIN
          j.restore.push(() => {
            material.emissiveIntensity = previous
          })
          const radiance = material.emissive.clone().multiplyScalar(material.emissiveIntensity)
          if (radiance.r + radiance.g + radiance.b > 0) emitters.push({ mesh: m, radiance })
        })
      }
      const center = new Vector3(0, 1.5, 0)
      if (floor) {
        floor.geometry.computeBoundingBox()
        floor.geometry.boundingBox!.clone().applyMatrix4(floor.matrixWorld).getCenter(center)
        center.y = 1.5
      }

      j.baker = new LightBaker(gl, scene)
      const washes =
        ceilingWash > 0 && ceiling
          ? [{ receiver: 'ceiling', irradiance: new Color(1, 1, 1).multiplyScalar(ceilingWash) }]
          : []
      j.baker.prepare(receivers, emitters, center, washes)
      // Lamps are captured as data: culling can resume.
      setBakeAllRooms(false)
      j.run = j.baker.run()
      ;(j as unknown as { receivers: BakeReceiver[] }).receivers = receivers
      return
    }

    if (!j.run) return
    const start = performance.now()
    while (performance.now() - start < FRAME_BUDGET) {
      if (!j.run.next().done) continue
      j.run = null
      const receivers = (j as unknown as { receivers: BakeReceiver[] }).receivers
      receivers.forEach((r, index) => {
        const lightMap = j.baker!.lightMap(index)
        if (!lightMap) return
        if (r.name === 'floor') {
          j.restore.push(patchStandard(r.mesh.material as MeshStandardMaterial, lightMap))
          return
        }
        if (r.name === 'props') {
          lightMap.channel = 1
          j.props.forEach((prop) =>
            j.restore.push(patchStandard(prop.material as MeshStandardMaterial, lightMap)),
          )
          return
        }
        const display = j.unwrapped[r.name] ?? r.mesh
        if (display !== r.mesh) lightMap.channel = 1
        const previous = display.material as Material
        // Plaster walls: a matte PBR surface — the bake is its diffuse light, its normal and
        // roughness maps as authored shape the room's reflection (the sheen) on it.
        const plaster = j.unwrapped[r.name] ? j.plaster : null
        let baked: Material
        if (plaster) {
          const standard = new MeshStandardMaterial({
            color: r.albedo,
            normalMap: plaster.normal,
            roughnessMap: plaster.roughness,
            roughness: 1,
            metalness: 0,
            side: DoubleSide,
          })
          // DEBUG A/B (spike): isolate the plaster's two parts — `&ar161plasternospec=1` no
          // sheen (environment reflection), `&ar161plasterflat=1` no relief shading.
          const search = window.location.search
          if (search.includes('ar161plasternospec=1')) standard.envMapIntensity = 0
          const direction = search.includes('ar161plasterflat=1')
            ? null
            : j.baker!.directionMap(index)
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
        j.restore.push(() => {
          display.material = previous
          baked.dispose()
        })
      })
      // Artworks: their measured daylight + bounce on every part of their group.
      const patched = new Set<Material>()
      for (const image of j.art) {
        image.updateMatrixWorld(true)
        image.geometry.computeBoundingBox()
        const box = image.geometry.boundingBox!.clone().applyMatrix4(image.matrixWorld)
        const irradiance = j.baker!.meanIrradianceIn('art', box)
        artworkGroup(image).traverse((o) => {
          const material = (o as Mesh).material as MeshStandardMaterial | undefined
          if (!(o as Mesh).isMesh || !material?.isMeshStandardMaterial || patched.has(material))
            return
          patched.add(material)
          j.restore.push(patchArtBounce(material, irradiance))
        })
      }
      if (j.art.length)
        console.info(
          '[AR-161 art bounce]',
          JSON.stringify({ works: j.art.length, materials: patched.size }),
        )
      requestRoomRecapture()
      // The light on the brightest-lit artwork (rooms with no artwork: none).
      const bounce = j.baker!.bounceColor('wall')
      const artLight = brightestArtworkLight(scene, bounce)
      ;(window as unknown as { __ar161ArtLux?: unknown }).__ar161ArtLux = artworkIrradiances(
        scene,
        bounce,
      )
      if (whiteBalance) {
        // White-balance on the art's own light — lamps plus what the room bounces onto it (a
        // wood floor's warmth included), so a print's white reads white. No artwork: the lamps.
        const white = artLight ?? j.baker!.lampWhite()
        const lum = luminance(white)
        if (lum > 0 && white.r > 0 && white.g > 0 && white.b > 0) {
          setMeteredWhiteBalance([lum / white.r, lum / white.g, lum / white.b])
          j.restore.push(() => setMeteredWhiteBalance(null))
        }
      }
      if (autoExposure) {
        // The camera is fixed. It is stopped DOWN only if the brightest-lit artwork's paper
        // white would pass the top of Neutral's identity range (shifting its colours toward
        // white) — never brightened: a dim room needs more light, not more exposure.
        // Rooms with no artwork fall back to the brightest wall.
        const artPeak = artLight ? luminance(artLight) : 0
        const peak = artPeak > 0 ? artPeak : j.baker!.percentileIrradiance('wall', 0.97)
        const paperRadiance = (PAPER_ALBEDO * peak) / Math.PI
        const guard = paperRadiance > 0 ? ART_WHITE_TARGET / paperRadiance : CAMERA_EXPOSURE
        const exposure = Math.min(CAMERA_EXPOSURE, guard)
        setMeteredExposure(exposure)
        const wall = j.baker!.percentileIrradiance('wall', 0.5)
        const ceiling = j.baker!.percentileIrradiance('ceiling', 0.5)
        console.info(
          '[AR-161 meter]',
          JSON.stringify({
            artPeakLux: Math.round(artPeak * LUX_PER_UNIT),
            wallMedianLux: Math.round(wall * LUX_PER_UNIT),
            ceilingMedianLux: Math.round(ceiling * LUX_PER_UNIT),
            bounceLux: Math.round(luminance(bounce) * LUX_PER_UNIT),
            artToWall: +(artPeak / wall).toFixed(2),
            paperWhite: +(paperRadiance * exposure).toFixed(3),
            exposure: +exposure.toFixed(3),
            whiteBalance: artLight
              ? [artLight.r, artLight.g, artLight.b].map(
                  (c) => +(luminance(artLight) / c).toFixed(3),
                )
              : null,
          }),
        )
        j.restore.push(() => setMeteredExposure(null))
      }
      console.info('[AR-161 bake]', JSON.stringify(j.baker!.stats))
      // Spike diagnostics: the headless harness reads these.
      ;(window as unknown as { __ar161Bake?: unknown }).__ar161Bake = j.baker!.debugDump()
      ;(window as unknown as { __ar161Baker?: unknown }).__ar161Baker = j.baker
      break
    }
  })

  return null
}

export default LoadTimeBake
