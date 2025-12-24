import { useEffect, useMemo, useRef } from 'react'
import { SRGBColorSpace, Mesh, BufferGeometry, MeshStandardMaterial, Texture, Color } from 'three'

import { useAmbientLight } from '@/hooks/useAmbientLight'

interface FloorProps {
  nodes: {
    floor: Mesh & {
      geometry: BufferGeometry
    }
  }
  materials: {
    floorMaterial: MeshStandardMaterial & {
      map?: Texture
    }
  }
}

const Floor: React.FC<FloorProps> = ({ nodes, materials }) => {
  const meshRef = useRef<Mesh>(null)
  const { ambientColor, scale } = useAmbientLight()

  useMemo(() => {
    if (materials.floorMaterial.map) {
      materials.floorMaterial.map.colorSpace = SRGBColorSpace
    }
  }, [materials])

  // Apply ambient light as color multiplier
  useEffect(() => {
    if (materials.floorMaterial) {
      const color = new Color(ambientColor)
      color.multiplyScalar(scale)
      materials.floorMaterial.color = color
    }
  }, [materials, ambientColor, scale])

  return (
    <mesh
      ref={meshRef}
      name="floor"
      castShadow
      receiveShadow
      geometry={nodes.floor.geometry}
      material={materials.floorMaterial}
    />
  )
}

export default Floor

