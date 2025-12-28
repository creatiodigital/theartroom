import { useTexture } from '@react-three/drei'
import { BufferGeometry, RepeatWrapping, SRGBColorSpace, Vector2, DoubleSide } from 'three'

interface PlasterCeilingProps {
  geometry: BufferGeometry
  texturePath?: string
  texturePrefix?: string
  textureRepeat?: number
}

/**
 * Ceiling with PBR plaster material.
 */
const PlasterCeiling: React.FC<PlasterCeilingProps> = ({ 
  geometry, 
  texturePath = '/assets/materials/plaster',
  texturePrefix = 'Poliigon_PlasterPainted_7664',
  textureRepeat = 2,
}) => {
  // Load PBR textures
  const textures = useTexture({
    map: `${texturePath}/${texturePrefix}_BaseColor.jpg`,
    normalMap: `${texturePath}/${texturePrefix}_Normal.png`,
    roughnessMap: `${texturePath}/${texturePrefix}_Roughness.jpg`,
    metalnessMap: `${texturePath}/${texturePrefix}_Metallic.jpg`,
    aoMap: `${texturePath}/${texturePrefix}_AmbientOcclusion.jpg`,
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
      name="ceiling"
      geometry={geometry}
      receiveShadow
    >
      <meshStandardMaterial
        map={textures.map}
        normalMap={textures.normalMap}
        normalScale={new Vector2(0.2, 0.2)}
        roughnessMap={textures.roughnessMap}
        roughness={1.0}
        metalnessMap={textures.metalnessMap}
        metalness={0}
        aoMap={textures.aoMap}
        aoMapIntensity={0.5}
        envMapIntensity={0}
        side={DoubleSide}
      />
    </mesh>
  )
}

export { PlasterCeiling }
export default PlasterCeiling
