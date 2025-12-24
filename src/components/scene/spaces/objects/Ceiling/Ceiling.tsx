import { useEffect, useMemo } from 'react'
import { SRGBColorSpace, MeshStandardMaterial, Mesh, BufferGeometry, Texture, Color } from 'three'

import { useAmbientLight } from '@/hooks/useAmbientLight'

interface CeilingProps {
  nodes: {
    ceiling: Mesh & {
      geometry: BufferGeometry
    }
  }
  materials: {
    ceilingMaterial: MeshStandardMaterial & {
      map?: Texture
    }
  }
}

const Ceiling: React.FC<CeilingProps> = ({ nodes, materials }) => {
  const { ambientColor, scale } = useAmbientLight()

  useMemo(() => {
    if (materials.ceilingMaterial.map) {
      materials.ceilingMaterial.map.colorSpace = SRGBColorSpace
    }
  }, [materials])

  // Apply ambient light as color multiplier
  useEffect(() => {
    if (materials.ceilingMaterial) {
      const color = new Color(ambientColor)
      color.multiplyScalar(scale)
      materials.ceilingMaterial.color = color
    }
  }, [materials, ambientColor, scale])

  return (
    <mesh
      name="ceiling"
      castShadow
      receiveShadow
      geometry={nodes.ceiling.geometry}
      material={materials.ceilingMaterial}
    />
  )
}

export default Ceiling
