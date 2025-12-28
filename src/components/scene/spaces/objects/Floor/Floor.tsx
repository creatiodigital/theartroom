import { useEffect, useRef } from 'react'
import { Mesh, BufferGeometry, MeshStandardMaterial, Color } from 'three'

import { useAmbientLight } from '@/hooks/useAmbientLight'

interface FloorProps {
  geometry: BufferGeometry
  material: MeshStandardMaterial
}

const Floor: React.FC<FloorProps> = ({ geometry, material }) => {
  const meshRef = useRef<Mesh>(null)
  const { ambientColor, scale } = useAmbientLight()

  // Apply ambient light as subtle color tint
  useEffect(() => {
    if (material) {
      const color = new Color(ambientColor)
      color.multiplyScalar(Math.max(0.9, scale))
      material.color = color
    }
  }, [material, ambientColor, scale])

  return (
    <mesh
      ref={meshRef}
      name="floor"
      castShadow
      receiveShadow
      geometry={geometry}
      material={material}
    />
  )
}

export default Floor
