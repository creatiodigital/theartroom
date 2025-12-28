import { useEffect, useMemo } from 'react'
import { SRGBColorSpace, MeshStandardMaterial, BufferGeometry, Color } from 'three'

import { useAmbientLight } from '@/hooks/useAmbientLight'

interface CeilingProps {
  geometry: BufferGeometry
  material: MeshStandardMaterial
}

// Default ceiling material fallback
const DEFAULT_CEILING_COLOR = '#f5f5f5'

const Ceiling: React.FC<CeilingProps> = ({ geometry, material }) => {
  const { ambientColor, scale } = useAmbientLight()

  // Ensure ceiling material is double-sided
  const ceilingMaterial = useMemo(() => {
    if (material) {
      material.side = 2 // DoubleSide
      if (material.map) {
        material.map.colorSpace = SRGBColorSpace
      }
      return material
    }
    // Fallback: create a default ceiling material
    return new MeshStandardMaterial({
      color: new Color(DEFAULT_CEILING_COLOR),
      roughness: 0.9,
      metalness: 0,
      side: 2, // DoubleSide
    })
  }, [material])

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
      geometry={geometry}
      material={ceilingMaterial}
    />
  )
}

export default Ceiling
