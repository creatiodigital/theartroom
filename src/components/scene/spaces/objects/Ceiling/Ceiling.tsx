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
      map?: Texture | null
    }
  }
}
// Default ceiling material (light gray, double-sided)
const DEFAULT_CEILING_COLOR = '#f5f5f5'

const Ceiling: React.FC<CeilingProps> = ({ nodes, materials }) => {
  const { ambientColor, scale } = useAmbientLight()

  // Ensure ceiling material exists and is double-sided
  const ceilingMaterial = useMemo(() => {
    if (materials.ceilingMaterial) {
      // Make existing material double-sided so it's visible from below
      materials.ceilingMaterial.side = 2 // DoubleSide
      if (materials.ceilingMaterial.map) {
        materials.ceilingMaterial.map.colorSpace = SRGBColorSpace
      }
      return materials.ceilingMaterial
    }
    // Fallback: create a default ceiling material
    return new MeshStandardMaterial({
      color: new Color(DEFAULT_CEILING_COLOR),
      roughness: 0.9,
      metalness: 0,
      side: 2, // DoubleSide
    })
  }, [materials])

  // Apply ambient light as color multiplier
  useEffect(() => {
    if (ceilingMaterial) {
      const color = new Color(ambientColor)
      color.multiplyScalar(scale)
      ceilingMaterial.color = color
    }
  }, [ceilingMaterial, ambientColor, scale])

  return (
    <mesh
      name="ceiling"
      castShadow
      receiveShadow
      geometry={nodes.ceiling.geometry}
      material={ceilingMaterial}
    />
  )
}

export default Ceiling
