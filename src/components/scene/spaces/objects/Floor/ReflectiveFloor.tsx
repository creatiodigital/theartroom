import { useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { Mesh, BufferGeometry, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three'

interface ReflectiveFloorProps {
  geometry: BufferGeometry
  texturePath?: string
  texturePrefix?: string
  textureRepeat?: number
  reflectionBlur?: number
  reflectionMixStrength?: number
}

/**
 * Polished floor with PBR textures and specular highlights.
 * Uses standard material for consistent appearance without reflection camera artifacts.
 */
const ReflectiveFloor: React.FC<ReflectiveFloorProps> = ({ 
  geometry, 
  texturePath = '/assets/materials/polished_floor',
  texturePrefix = 'exquistite-polished-tile',
  textureRepeat = 0.5,
}) => {
  const meshRef = useRef<Mesh>(null)

  // Load PBR textures
  const textures = useTexture({
    map: `${texturePath}/${texturePrefix}_albedo.png`,
    normalMap: `${texturePath}/${texturePrefix}_normal-ogl.png`,
    roughnessMap: `${texturePath}/${texturePrefix}_roughness.png`,
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
        envMapIntensity={0.5}
      />
    </mesh>
  )
}

export { ReflectiveFloor }
export default ReflectiveFloor
