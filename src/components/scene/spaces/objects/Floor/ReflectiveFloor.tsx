import { useRef } from 'react'
import { useSelector } from 'react-redux'
import { useTexture } from '@react-three/drei'
import { Mesh, BufferGeometry, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three'
import type { RootState } from '@/redux/store'

interface ReflectiveFloorProps {
  geometry: BufferGeometry
  texturePath?: string
  textureRepeat?: number
}

const DEFAULT_FLOOR_REFLECTIVENESS = 0.3

/**
 * Polished floor with PBR textures and specular highlights.
 * Reflectiveness is controlled via Redux for dynamic adjustment.
 */
const ReflectiveFloor: React.FC<ReflectiveFloorProps> = ({
  geometry,
  texturePath = '/assets/materials/concrete',
  textureRepeat = 0.5,
}) => {
  const meshRef = useRef<Mesh>(null)

  const reflectiveness = useSelector(
    (state: RootState) => state.exhibition.floorReflectiveness ?? DEFAULT_FLOOR_REFLECTIVENESS,
  )

  // Lower roughness = more reflective (invert the value)
  const roughness = 1 - reflectiveness

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
    texture.repeat.set(textureRepeat, textureRepeat)
  })
  textures.map.colorSpace = SRGBColorSpace

  return (
    <mesh 
      key={`floor-${reflectiveness}`}
      ref={meshRef} 
      name="floor" 
      geometry={geometry} 
      receiveShadow
    >
      <meshStandardMaterial
        map={textures.map}
        normalMap={textures.normalMap}
        normalScale={new Vector2(0.2, 0.2)}
        // Only use roughnessMap when reflectiveness is low, otherwise it overrides our roughness
        roughnessMap={reflectiveness < 0.5 ? textures.roughnessMap : undefined}
        color="#9a958f"
        roughness={roughness}
        metalness={reflectiveness * 0.8}
        envMapIntensity={1 + reflectiveness * 3}
      />
    </mesh>
  )
}

export { ReflectiveFloor }
export default ReflectiveFloor

