import { useEffect, useMemo, useRef } from 'react'
import { SRGBColorSpace, Mesh, BufferGeometry, MeshStandardMaterial, Color, Vector2 } from 'three'

import { useAmbientLight } from '@/hooks/useAmbientLight'

interface FloorProps {
  geometry: BufferGeometry
  material: MeshStandardMaterial
}

const Floor: React.FC<FloorProps> = ({ geometry, material }) => {
  const meshRef = useRef<Mesh>(null)
  const { ambientColor, scale } = useAmbientLight()

  useMemo(() => {
    if (material.map) {
      material.map.colorSpace = SRGBColorSpace
    }

    // Enhance normal map visibility if present
    if (material.normalMap) {
      // Normal maps should use LinearSRGBColorSpace (not sRGB)
      material.normalMap.colorSpace = '' as any // Linear/default
      
      // Boost normal map intensity for more visible surface detail
      material.normalScale = new Vector2(3.0, 3.0)
    }

    // Ensure good roughness for realistic flooring
    if (material.roughness < 0.3) {
      material.roughness = 0.6
    }

    // Ensure metalness is low for non-metallic floors
    if (material.metalness > 0.3) {
      material.metalness = 0.0
    }
  }, [material])

  // Apply ambient light as color tint
  useEffect(() => {
    if (material) {
      const color = new Color(ambientColor)
      color.multiplyScalar(Math.max(0.8, scale))
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
