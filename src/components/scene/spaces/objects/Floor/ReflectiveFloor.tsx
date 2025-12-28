import { useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { Mesh, BufferGeometry, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three'

interface ReflectiveFloorProps {
  geometry: BufferGeometry
  texturePath?: string
  textureRepeat?: number
}

/**
 * Polished floor with PBR textures and specular highlights.
 * Uses standard material for consistent appearance without reflection camera artifacts.
 */
const ReflectiveFloor: React.FC<ReflectiveFloorProps> = ({ 
  geometry, 
  texturePath = '/assets/materials/concrete',
  textureRepeat = 0.5,
}) => {
  const meshRef = useRef<Mesh>(null)

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
      ref={meshRef}
      name="floor"
      geometry={geometry}
      receiveShadow
    >
      <meshStandardMaterial
        map={textures.map}
        normalMap={textures.normalMap}
        normalScale={new Vector2(0.8, 0.8)}
        roughnessMap={textures.roughnessMap}
        color="#8a8580"
        roughness={0.3}
        metalness={0.1}
        envMapIntensity={0}
      />
    </mesh>
  )
}

export { ReflectiveFloor }
export default ReflectiveFloor
