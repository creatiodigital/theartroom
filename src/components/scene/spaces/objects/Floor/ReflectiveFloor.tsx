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

// Material configurations with file extensions
const MATERIAL_CONFIG = {
  concrete: {
    diffuse: 'diffuse.png',
    normal: 'normal.png',
    roughness: 'roughness.png',
    metallic: 'metallic.png',
  },
  wood: {
    diffuse: 'diffuse.jpg',
    normal: 'normal.png',
    roughness: 'roughness.jpg',
    metallic: 'metallic.jpg',
  },
} as const

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

  // Clamp scale for safety (0.45 = largest tiles, 2 = smallest)
  const clampedScale = Math.max(0.45, Math.min(2.0, floorTextureScale))

  // Get material config for dynamic texture paths
  const materialConfig = MATERIAL_CONFIG[floorMaterial] || MATERIAL_CONFIG.concrete
  const texturePath = `/assets/materials/${floorMaterial}`

  // Load PBR textures with correct extensions per material
  const textures = useTexture({
    map: `${texturePath}/${materialConfig.diffuse}`,
    normalMap: `${texturePath}/${materialConfig.normal}`,
    roughnessMap: `${texturePath}/${materialConfig.roughness}`,
    metalnessMap: `${texturePath}/${materialConfig.metallic}`,
  })

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
        color="#9a958f"
        metalness={0.1}
        mirror={reflectiveness * 0.05}
        map={textures.map}
        normalMap={textures.normalMap}
        roughnessMap={reflectiveness < 0.3 ? textures.roughnessMap : undefined}
        metalnessMap={textures.metalnessMap}
      />
    </mesh>
  )
}

export { ReflectiveFloor }
export default ReflectiveFloor

