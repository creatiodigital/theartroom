import { useTexture } from '@react-three/drei'
import { Mesh, BufferGeometry, RepeatWrapping, SRGBColorSpace, Vector2, DoubleSide } from 'three'

interface PlasterWallProps {
  i: number
  wallRef: React.Ref<Mesh>
  geometry: BufferGeometry
  texturePath?: string
  textureRepeat?: number
}

/**
 * Wall with PBR plaster material.
 */
const PlasterWall: React.FC<PlasterWallProps> = ({
  i,
  wallRef,
  geometry,
  texturePath = '/assets/materials/plaster',
  textureRepeat = 2,
}) => {
  // Load PBR textures
  const textures = useTexture({
    map: `${texturePath}/diffuse.jpg`,
    normalMap: `${texturePath}/normal.png`,
    roughnessMap: `${texturePath}/roughness.jpg`,
    metalnessMap: `${texturePath}/metallic.jpg`,
    aoMap: `${texturePath}/ao.jpg`,
  })

  // Configure texture tiling
  Object.values(textures).forEach((texture) => {
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(textureRepeat, textureRepeat)
  })
  textures.map.colorSpace = SRGBColorSpace

  return (
    <mesh ref={wallRef} name={`wall${i}`} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        map={textures.map}
        normalMap={textures.normalMap}
        normalScale={new Vector2(0.1, 0.1)}
        roughnessMap={textures.roughnessMap}
        roughness={1.0}
        metalnessMap={textures.metalnessMap}
        metalness={0}
        aoMap={textures.aoMap}
        aoMapIntensity={0.8}
        envMapIntensity={0}
        side={DoubleSide}
      />
    </mesh>
  )
}

export { PlasterWall }
export default PlasterWall
