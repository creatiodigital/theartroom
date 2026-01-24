import { useMemo, useRef } from 'react'
import { useSelector } from 'react-redux'
import { MeshReflectorMaterial, useTexture } from '@react-three/drei'
import { Mesh, RepeatWrapping, SRGBColorSpace } from 'three'
import type { Vector3Tuple } from 'three'
import type { RootState } from '@/redux/store'

interface ReflectiveFloorProps {
  position?: Vector3Tuple
}

const DEFAULT_FLOOR_REFLECTIVENESS = 0.3
const DEFAULT_FLOOR_TEXTURE_SCALE = 1.0

// Temperature color presets
const COOL_COLOR = { r: 0x8a, g: 0x92, b: 0x98 } // Blue-gray
const NEUTRAL_COLOR = { r: 0x9a, g: 0x95, b: 0x8f } // Original
const WARM_COLOR = { r: 0xa8, g: 0x9a, b: 0x8a } // Amber

// Interpolate between colors based on temperature (-1 to 1)
const getTemperatureColor = (temperature: number): string => {
  const t = Math.max(-1, Math.min(1, temperature))
  let r, g, b
  
  if (t < 0) {
    // Cool: interpolate from neutral to cool
    const factor = -t
    r = Math.round(NEUTRAL_COLOR.r + (COOL_COLOR.r - NEUTRAL_COLOR.r) * factor)
    g = Math.round(NEUTRAL_COLOR.g + (COOL_COLOR.g - NEUTRAL_COLOR.g) * factor)
    b = Math.round(NEUTRAL_COLOR.b + (COOL_COLOR.b - NEUTRAL_COLOR.b) * factor)
  } else {
    // Warm: interpolate from neutral to warm
    const factor = t
    r = Math.round(NEUTRAL_COLOR.r + (WARM_COLOR.r - NEUTRAL_COLOR.r) * factor)
    g = Math.round(NEUTRAL_COLOR.g + (WARM_COLOR.g - NEUTRAL_COLOR.g) * factor)
    b = Math.round(NEUTRAL_COLOR.b + (WARM_COLOR.b - NEUTRAL_COLOR.b) * factor)
  }
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Material configurations with file extensions (metallic and normal are optional - set to null if not available)
const MATERIAL_CONFIG: Record<string, { diffuse: string; normal: string | null; roughness: string; metallic: string | null }> = {
  concrete: {
    diffuse: 'diffuse.png',
    normal: 'normal.png',
    roughness: 'roughness.png',
    metallic: 'metallic.png',
  },
  wood: {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    roughness: 'roughness.jpg',
    metallic: null,
  },
  marble: {
    diffuse: 'diffuse.jpg',
    normal: 'normal.jpg',
    roughness: 'roughness.jpg',
    metallic: null,
  },
}

/**
 * Polished floor with mirror reflections and PBR textures.
 * Reads material, texture scale, and reflectiveness from Redux.
 */
const ReflectiveFloor: React.FC<ReflectiveFloorProps> = ({
  position = [0, 0, 0],
}) => {
  const meshRef = useRef<Mesh>(null)

  // Read floor settings from Redux
  const floorMaterial = useSelector(
    (state: RootState) => state.exhibition.floorMaterial ?? 'concrete',
  )

  const floorTextureScale = useSelector(
    (state: RootState) => state.exhibition.floorTextureScale ?? DEFAULT_FLOOR_TEXTURE_SCALE,
  )

  const reflectiveness = useSelector(
    (state: RootState) => state.exhibition.floorReflectiveness ?? DEFAULT_FLOOR_REFLECTIVENESS,
  )

  const floorTextureOffsetX = useSelector(
    (state: RootState) => state.exhibition.floorTextureOffsetX ?? 0,
  )

  const floorTextureOffsetY = useSelector(
    (state: RootState) => state.exhibition.floorTextureOffsetY ?? 0,
  )

  const floorTemperature = useSelector(
    (state: RootState) => state.exhibition.floorTemperature ?? 0,
  )

  // Compute temperature-based floor color
  const floorColor = getTemperatureColor(floorTemperature)

  // Clamp scale for safety (0.45 = largest tiles, 2 = smallest)
  const clampedScale = Math.max(0.45, Math.min(2.0, floorTextureScale))

  // Get material config for dynamic texture paths
  const materialConfig = MATERIAL_CONFIG[floorMaterial] || MATERIAL_CONFIG.concrete
  const texturePath = `/assets/materials/${floorMaterial}`

  // Build texture paths (metallic and normal are optional)
  const texturePaths: Record<string, string> = {
    map: `${texturePath}/${materialConfig.diffuse}`,
    roughnessMap: `${texturePath}/${materialConfig.roughness}`,
  }
  if (materialConfig.normal) {
    texturePaths.normalMap = `${texturePath}/${materialConfig.normal}`
  }
  if (materialConfig.metallic) {
    texturePaths.metalnessMap = `${texturePath}/${materialConfig.metallic}`
  }

  // Load PBR textures with correct extensions per material
  const textures = useTexture(texturePaths)

  // Configure texture tiling and offset
  useMemo(() => {
    Object.values(textures).forEach((texture) => {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(clampedScale * 10, clampedScale * 10)
      texture.offset.set(floorTextureOffsetX, floorTextureOffsetY)
    })
    textures.map.colorSpace = SRGBColorSpace
  }, [textures, clampedScale, floorTextureOffsetX, floorTextureOffsetY])

  return (
    <mesh
      ref={meshRef}
      name="floor"
      rotation={[-Math.PI / 2, 0, 0]}
      position={position}
      receiveShadow
    >
      <planeGeometry args={[100, 100]} />
      <MeshReflectorMaterial
        blur={[500, 300]}
        resolution={1024}
        mixBlur={1}
        mixStrength={reflectiveness * 3}
        roughness={1 - reflectiveness * 0.3}
        depthScale={0}
        color={floorColor}
        metalness={0.1}
        mirror={reflectiveness * 0.05}
        map={textures.map}
        normalMap={textures.normalMap}
        normalScale={[0.8, 0.8]}
        roughnessMap={reflectiveness < 0.3 ? textures.roughnessMap : undefined}
        metalnessMap={textures.metalnessMap}
      />
    </mesh>
  )
}

export { ReflectiveFloor }
export default ReflectiveFloor
