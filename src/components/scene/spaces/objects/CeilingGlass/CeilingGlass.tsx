import { BufferGeometry, Material } from 'three'

interface CeilingGlassProps {
  geometry: BufferGeometry
  material: Material
}

const CeilingGlass: React.FC<CeilingGlassProps> = ({ geometry, material }) => {
  return (
    <mesh
      name="glass"
      castShadow
      receiveShadow
      geometry={geometry}
      material={material}
    />
  )
}

export default CeilingGlass
