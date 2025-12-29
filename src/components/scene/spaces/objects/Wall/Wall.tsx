import { useEffect, useMemo } from 'react'
import { SRGBColorSpace, Mesh, BufferGeometry, MeshStandardMaterial, Color } from 'three'

import { useAmbientLight } from '@/hooks/useAmbientLight'

interface WallProps {
  i: number
  wallRef: React.Ref<Mesh>
  geometry: BufferGeometry
  material: MeshStandardMaterial
}

const Wall: React.FC<WallProps> = ({ i, wallRef, geometry, material }) => {
  const { ambientColor, scale } = useAmbientLight()

  useMemo(() => {
    if (material?.map) {
      material.map.colorSpace = SRGBColorSpace
    }
  }, [material])

  // Apply ambient light as color multiplier
  useEffect(() => {
    if (material) {
      const color = new Color(ambientColor)
      color.multiplyScalar(scale)
      material.color = color
    }
  }, [material, ambientColor, scale])

  return (
    <mesh
      name={`wall${i}`}
      ref={wallRef}
      castShadow
      receiveShadow
      geometry={geometry}
      material={material}
    />
  )
}

export default Wall
