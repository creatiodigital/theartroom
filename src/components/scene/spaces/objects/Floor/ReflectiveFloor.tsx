import { useRef } from 'react'
import { useSelector } from 'react-redux'
import { MeshReflectorMaterial, useTexture } from '@react-three/drei'
import { Mesh, RepeatWrapping, SRGBColorSpace } from 'three'
import type { Vector3Tuple } from 'three'
import type { RootState } from '@/redux/store'

interface ReflectiveFloorProps {
  texturePath?: string
  textureRepeat?: number
  position?: Vector3Tuple
}

const DEFAULT_FLOOR_REFLECTIVENESS = 0.3

/**
 * Polished floor with mirror reflections and PBR textures.
 */
const ReflectiveFloor: React.FC<ReflectiveFloorProps> = ({
  texturePath = '/assets/materials/concrete',
  textureRepeat = 1,
  position = [0, 0, 0],
}) => {
  const meshRef = useRef<Mesh>(null)

  const reflectiveness = useSelector(
    (state: RootState) => state.exhibition.floorReflectiveness ?? DEFAULT_FLOOR_REFLECTIVENESS,
  )

  // Load PBR textures
  const textures = useTexture({
    map: `${texturePath}/diffuse.png`,
    normalMap: `${texturePath}/normal.png`,
    roughnessMap: `${texturePath}/roughness.png`,
  })

  // Configure texture tiling
  Object.values(textures).forEach((texture) => {
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(textureRepeat * 10, textureRepeat * 10)
  })
  textures.map.colorSpace = SRGBColorSpace

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
      />
    </mesh>
  )
}

export { ReflectiveFloor }
export default ReflectiveFloor
