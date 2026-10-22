import { useLayoutEffect, useMemo, useRef } from 'react'
import type { ComponentRef } from 'react'
import { useSelector } from 'react-redux'
import { MeshReflectorMaterial } from '@react-three/drei'
import { Mesh, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three'
import type { Vector3Tuple } from 'three'
import type { RootState } from '@/redux/store'
import { useResilientTexture } from '@/components/scene/useResilientTexture'
import { assetUrl } from '@/lib/assetUrl'
import { MAX_ANISOTROPY } from '@/components/scene/textureQuality'
import { useBakedLook } from '@/components/scene/bake/bakedLook'
import { bakedFloorTiling } from '@/lib/bake/commonFloor'

// Re-enabled 2026-09-07, after the fill-rate work (dpr ladder + MSAA) landed.
//
// This is the most expensive thing in the scene: MeshReflectorMaterial renders the whole
// room a SECOND time into a 1024 buffer every frame, and with 22 spotlights evaluated per
// pixel that is close to a second full lighting pass. Measured on a real prod show it cost
// ~3x the draw calls and still held a flat 60 fps at dpr 1.75 — it fits, but it competes
// with the dpr ladder for the same headroom. Weaker machines pay for it in RESOLUTION
// (softer wall text), not in framerate, because the ladder absorbs it silently.
//
// ⚠️ `floorReflectiveness` (the dashboard slider) scales only `mirror` / `mixStrength` — it
// does NOT skip this pass. A floor dialled to 0 still costs the full second render. Gate
// the ternary below on the value if that ever needs to be a real per-exhibition lever.
//
// If it ever needs to go: set false, and judge by the dpr line, not the fps — the ladder
// hides this cost in resolution.
const ENABLE_REFLECTIONS = true

// Bump this version when replacing floor texture files to bust Three.js cache
// v4: 2026-07-12 recompression (visually lossless; originals in R2 under
// app/assets/_originals-20260712/)
const TEXTURE_VERSION = 4

interface ReflectiveFloorProps {
  position?: Vector3Tuple
  width?: number
  depth?: number
}

const DEFAULT_FLOOR_REFLECTIVENESS = 0.3
const DEFAULT_FLOOR_TEXTURE_SCALE = 1.0

// Temperature color presets
const COOL_COLOR = { r: 0x8a, g: 0x92, b: 0x98 } // Blue-gray
const NEUTRAL_COLOR = { r: 0x9a, g: 0x95, b: 0x8f } // Original
const WARM_COLOR = { r: 0xa8, g: 0x9a, b: 0x8a } // Amber

type RGB = { r: number; g: number; b: number }

const WHITE: RGB = { r: 0xff, g: 0xff, b: 0xff }

// The material `color` MULTIPLIES the diffuse map. It used to be NEUTRAL_COLOR
// (#9a958f) for every floor, which is ~0.30 in linear light: each one rendered
// at roughly a third of its photographed brightness, so no wood could ever
// look light, whatever the lamps did. Floors now default to WHITE (texture at
// its true color); a floor can opt back into the old multiplier with
// `darken: true` where its texture was authored against it (worn-concrete).
//
// Temperature (-1 cool … 1 warm) is applied RELATIVE to the base: the shift
// from NEUTRAL to COOL/WARM becomes a per-channel ratio. On NEUTRAL_COLOR this
// reproduces the original absolute colors exactly; on WHITE it is scaled down
// so no channel clips, which keeps the hue shift without darkening the floor.
const getTemperatureColor = (temperature: number, base: RGB): string => {
  const t = Math.max(-1, Math.min(1, temperature))
  const target = t < 0 ? COOL_COLOR : WARM_COLOR
  const factor = Math.abs(t)

  const shifted = (['r', 'g', 'b'] as const).map((ch) => {
    const tinted = NEUTRAL_COLOR[ch] + (target[ch] - NEUTRAL_COLOR[ch]) * factor
    return (base[ch] * Math.round(tinted)) / NEUTRAL_COLOR[ch]
  })
  const peak = Math.max(...shifted)
  const fit = peak > 255 ? 255 / peak : 1

  return `#${shifted
    .map((v) =>
      Math.round(v * fit)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

// Material configurations with file extensions (optional maps set to null)
const MATERIAL_CONFIG: Record<
  string,
  {
    diffuse: string
    normal: string | null
    bump: string | null
    roughness: string | null
    metallic: string | null
    ao: string | null
    /** Keep the original NEUTRAL_COLOR multiplier instead of WHITE. */
    darken?: boolean
  }
> = {
  concrete: {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: 'metallic.jpg',
    ao: null,
  },
  marble: {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: null,
  },

  parquet: {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: 'ao.jpg',
  },
  'patterned-concrete': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: 'ao.jpg',
  },
  // Looks blown out at true color: its texture was tuned against the old
  // multiplier, so it keeps it.
  'worn-concrete': {
    darken: true,
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: 'metallic.jpg',
    ao: 'ao.jpg',
  },
  'wood-planks': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: 'ao.jpg',
  },
  'parquet-light': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: null,
  },
  // ⚠️ AR-161: the common floor of every baked space (`COMMON_FLOOR`) — parquet-light with two
  // thirds of its orange taken out and lifted to a pale oak (linear albedo 0.40, R/B 1.37 vs 0.30,
  // 2.76): every floor bounce was painting the room beige-brown. On R2 like the other sets
  // (public/ copy is local-only, never commit).
  'parquet-whitewash': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: null,
  },
  'concrete-tiles': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: 'ao.jpg',
  },
  'clear-wood': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: 'ao.jpg',
  },
  // No AO map shipped with this set.
  'parquet-soft': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: null,
  },
  'parquet-white': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: 'ao.jpg',
  },
  'dark-concrete': {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    bump: null,
    roughness: 'roughness.jpg',
    metallic: null,
    ao: 'ao.jpg',
  },
}

// Resolve legacy/deleted material names to valid ones
const MATERIAL_ALIASES: Record<string, string> = {
  chevron: 'parquet',
}

const resolveFloorMaterial = (material?: string | null): string => {
  const resolved = MATERIAL_ALIASES[material ?? ''] || material || 'concrete'
  return MATERIAL_CONFIG[resolved] ? resolved : 'concrete'
}

// Build the exact URL set the component loads for a material. Shared between
// render and preload so the preloaded cache entries always match (?v= included).
const buildFloorTexturePaths = (material: string): Record<string, string> => {
  const config = MATERIAL_CONFIG[material]
  // Resolve each FILE through assetUrl, not the folder: NEXT_PUBLIC_LOCAL_ASSETS
  // matches exact file paths, so a folder-level call never hits the local override.
  const path = (file: string) => `/assets/materials/${material}/${file}`
  const url = (file: string) => `${assetUrl(path(file))}?v=${TEXTURE_VERSION}`
  const paths: Record<string, string> = {
    map: url(config.diffuse),
  }
  if (config.roughness) paths.roughnessMap = url(config.roughness)
  if (config.normal) paths.normalMap = url(config.normal)
  if (config.bump) paths.bumpMap = url(config.bump)
  if (config.metallic) paths.metalnessMap = url(config.metallic)
  if (config.ao) paths.aoMap = url(config.ao)
  return paths
}

// Preloading must happen OUTSIDE the render phase: if useLoader creates the
// texture promise while a component renders, the loading manager's onStart
// updates drei's useProgress store mid-render (Loader setState warning).
// Callers therefore warm the cache from effects/handlers before the floor
// mounts; the component's useLoader then suspends on the cached promise.

/** Warm the texture cache for ONE material — the visit page calls this with
 *  the exhibition's floorMaterial as soon as its data arrives, so visitors
 *  only download the set the room actually shows (each full set is 2–10 MB). */
export const preloadFloorMaterial = (material?: string | null) => {
  useResilientTexture.preload(Object.values(buildFloorTexturePaths(resolveFloorMaterial(material))))
}

/** Warm every material set — edit view only, where the artist can switch
 *  floors live and instant previews matter more than transfer size. */
export const preloadAllFloorMaterials = () => {
  Object.keys(MATERIAL_CONFIG).forEach((material) => preloadFloorMaterial(material))
}

/**
 * Polished floor with mirror reflections and PBR textures.
 * Reads material, texture scale, and reflectiveness from Redux.
 */
const ReflectiveFloor: React.FC<ReflectiveFloorProps> = ({
  position = [0, 0, 0],
  width = 100,
  depth = 100,
}) => {
  const meshRef = useRef<Mesh>(null)
  const reflectorRef = useRef<ComponentRef<typeof MeshReflectorMaterial>>(null)

  // Read floor settings from Redux
  const storedFloorMaterial = useSelector(
    (state: RootState) => state.exhibition.floorMaterial ?? 'concrete',
  )

  const storedTextureScale = useSelector(
    (state: RootState) => state.exhibition.floorTextureScale ?? DEFAULT_FLOOR_TEXTURE_SCALE,
  )

  const reflectiveness = useSelector(
    (state: RootState) => state.exhibition.floorReflectiveness ?? DEFAULT_FLOOR_REFLECTIVENESS,
  )

  const storedOffsetX = useSelector((state: RootState) => state.exhibition.floorTextureOffsetX ?? 0)

  const storedOffsetY = useSelector((state: RootState) => state.exhibition.floorTextureOffsetY ?? 0)

  const storedTemperature = useSelector(
    (state: RootState) => state.exhibition.floorTemperature ?? 0,
  )

  const storedNormalScale = useSelector(
    (state: RootState) => state.exhibition.floorNormalScale ?? 1.0,
  )

  const storedRotation = useSelector((state: RootState) => state.exhibition.floorRotation ?? 0)

  // AR-161: a baked space's approved look has one floor, the space's (`COMMON_FLOOR`), whatever
  // the exhibition stores: matte, with no mirror pass — its gloss is the captured room's
  // reflection (the environment's split-sum specular, Fresnel- and roughness-correct). The
  // boards' size and placement are the artist's (AR-163, `bakedFloorTiling`).
  const look = useBakedLook()
  const common = look.baked ? look.space.floor : null
  const tiling = common
    ? bakedFloorTiling(common, {
        floorMaterial: storedFloorMaterial,
        floorTextureScale: storedTextureScale,
        floorTextureOffsetX: storedOffsetX,
        floorTextureOffsetY: storedOffsetY,
        floorRotation: storedRotation,
      })
    : null
  const floorMaterial = common?.material ?? storedFloorMaterial
  const floorTextureScale = tiling?.textureScale ?? storedTextureScale
  const floorTextureOffsetX = tiling?.offsetX ?? storedOffsetX
  const floorTextureOffsetY = tiling?.offsetY ?? storedOffsetY
  const floorTemperature = common?.temperature ?? storedTemperature
  const floorNormalScale = common?.normalScale ?? storedNormalScale
  const floorRotation = tiling?.rotation ?? storedRotation

  // Clamp scale for safety (0.5 = largest tiles, 5.0 = smallest)
  const clampedScale = Math.max(0.5, Math.min(8.0, floorTextureScale))

  const validMaterial = resolveFloorMaterial(floorMaterial)

  // Temperature-tinted multiplier (white at neutral, unless the floor darkens)
  const floorColor = getTemperatureColor(
    floorTemperature,
    MATERIAL_CONFIG[validMaterial].darken ? NEUTRAL_COLOR : WHITE,
  )
  // Repeats per meter: one tile spans 10 / scale meters.
  const tileRepeat = clampedScale / 10

  // Build texture paths (metallic, normal, and ao are optional) — memoized to avoid
  // unstable references that cause useTexture to re-trigger loading on every render
  const texturePaths = useMemo(() => buildFloorTexturePaths(validMaterial), [validMaterial])

  // Load PBR textures with correct extensions per material. Uses the
  // resilient loader so a transient/aborted request retries and degrades
  // gracefully instead of throwing into the Canvas and crashing the scene.
  const textures = useResilientTexture(texturePaths)

  // Configure texture tiling, offset, and rotation
  useMemo(() => {
    const rotationRad = (floorRotation * Math.PI) / 180 // Convert degrees to radians
    // Scale repeat to maintain same physical tile size as the old 100-unit plane
    // Old: clampedScale * 10 on a 100-unit plane. Now: scale proportionally to actual floor size.
    const repeatX = width * tileRepeat
    const repeatY = depth * tileRepeat
    Object.values(textures).forEach((texture) => {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      if (texture.anisotropy !== MAX_ANISOTROPY) {
        texture.anisotropy = MAX_ANISOTROPY
        // A sampler parameter: three applies it only on (re)upload.
        texture.needsUpdate = true
      }
      texture.repeat.set(repeatX, repeatY)
      texture.offset.set(floorTextureOffsetX, floorTextureOffsetY)
      texture.rotation = rotationRad
      texture.center.set(0.5, 0.5) // Rotate around center
    })
    textures.map.colorSpace = SRGBColorSpace
  }, [textures, tileRepeat, floorTextureOffsetX, floorTextureOffsetY, floorRotation, width, depth])

  // Switching floors swaps the maps on the SAME material, and three.js does not
  // recompile when a map appears or disappears: going from a floor with an AO
  // (or metalness) map to one without left the shader sampling the previous
  // floor's texture, which three only rebinds while the map is set. That was
  // the "ghost" of the old floor. Rebuild the program whenever the set changes.
  // (A `key` remount would also work but re-allocates the reflector's buffers.)
  // Keyed on texturePaths, which is memoized per floor: `textures` is a new
  // object every render and would recompile on every slider tick.
  useLayoutEffect(() => {
    if (reflectorRef.current) reflectorRef.current.needsUpdate = true
  }, [texturePaths])

  // Create Vector2 for normalScale (required by Three.js)
  const normalScaleVec = useMemo(
    () => new Vector2(floorNormalScale, floorNormalScale),
    [floorNormalScale],
  )

  return (
    <mesh
      ref={meshRef}
      name="floor"
      rotation={[-Math.PI / 2, 0, 0]}
      position={position}
      receiveShadow
    >
      <planeGeometry
        args={[width, depth]}
        onUpdate={(geo) => {
          // AO maps require uv2 (attribute index 1). PlaneGeometry only has uv.
          if (!geo.attributes.uv2 && geo.attributes.uv) {
            geo.setAttribute('uv2', geo.attributes.uv)
          }
        }}
      />
      {common ? (
        <meshStandardMaterial
          key={`floor-common-${floorMaterial}`}
          color={floorColor}
          map={textures.map}
          normalMap={textures.normalMap}
          normalScale={normalScaleVec}
          bumpMap={textures.bumpMap}
          bumpScale={floorNormalScale}
          roughnessMap={textures.roughnessMap}
          aoMap={textures.aoMap}
          aoMapIntensity={1.0}
          envMapIntensity={1.0}
          roughness={common.roughness}
          metalness={common.metalness}
        />
      ) : ENABLE_REFLECTIONS ? (
        <MeshReflectorMaterial
          ref={reflectorRef}
          blur={[600, 400]} // Higher blur for maximum stability
          resolution={1024} // Full resolution for smooth reflections
          mixBlur={0.9} // High blend for stable reflections
          mixStrength={reflectiveness * 1.5} // Reduced from *3 to let normal map show
          mixContrast={1}
          roughness={1 - reflectiveness * 0.2}
          depthScale={0}
          minDepthThreshold={0.9}
          maxDepthThreshold={1}
          color={floorColor}
          metalness={0.05}
          mirror={reflectiveness * 0.03}
          map={textures.map}
          normalMap={textures.normalMap}
          normalScale={[floorNormalScale, floorNormalScale]} // Controlled by Floor Details slider
          bumpMap={textures.bumpMap}
          bumpScale={floorNormalScale}
          roughnessMap={textures.roughnessMap}
          metalnessMap={textures.metalnessMap}
          aoMap={textures.aoMap}
          aoMapIntensity={1.0}
          envMapIntensity={1.0}
        />
      ) : (
        <meshStandardMaterial
          key={`floor-mat-${floorMaterial}`}
          color={floorColor}
          map={textures.map}
          normalMap={textures.normalMap}
          normalScale={normalScaleVec}
          bumpMap={textures.bumpMap}
          bumpScale={floorNormalScale}
          roughnessMap={textures.roughnessMap}
          metalnessMap={textures.metalnessMap}
          aoMap={textures.aoMap}
          aoMapIntensity={1.0}
          envMapIntensity={1.0}
          roughness={1 - reflectiveness * 0.7} // 0→1.0 (matte), 1→0.3 (shiny)
          metalness={0.05 + reflectiveness * 0.25} // More metallic at high reflectiveness
        />
      )}
    </mesh>
  )
}

export { ReflectiveFloor }
export default ReflectiveFloor
