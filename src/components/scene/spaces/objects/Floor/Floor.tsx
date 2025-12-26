import { useEffect, useMemo, useRef } from 'react'
import { SRGBColorSpace, Mesh, BufferGeometry, MeshStandardMaterial, Texture, Color, Vector2 } from 'three'

import { useAmbientLight } from '@/hooks/useAmbientLight'

interface FloorProps {
  nodes: {
    floor: Mesh & {
      geometry: BufferGeometry
    }
  }
  materials: {
    floorMaterial: MeshStandardMaterial & {
      map?: Texture | null
      normalMap?: Texture | null
      roughnessMap?: Texture | null
      aoMap?: Texture | null
    }
  }
}

const Floor: React.FC<FloorProps> = ({ nodes, materials }) => {
  const meshRef = useRef<Mesh>(null)
  const { ambientColor, scale } = useAmbientLight()

  // Debug: Log material properties on mount
  useEffect(() => {
    console.log('=== Floor Material Debug ===')
    console.log('Material:', materials.floorMaterial)
    console.log('Base map:', materials.floorMaterial.map)
    console.log('Normal map:', materials.floorMaterial.normalMap)
    console.log('Normal scale:', materials.floorMaterial.normalScale)
    console.log('Roughness map:', materials.floorMaterial.roughnessMap)
    console.log('Roughness:', materials.floorMaterial.roughness)
    console.log('Metalness:', materials.floorMaterial.metalness)
    console.log('AO map:', materials.floorMaterial.aoMap)
    console.log('============================')
  }, [materials])

  useMemo(() => {
    if (materials.floorMaterial.map) {
      materials.floorMaterial.map.colorSpace = SRGBColorSpace
    }

    // Enhance normal map visibility if present
    if (materials.floorMaterial.normalMap) {
      // IMPORTANT: Normal maps should use LinearSRGBColorSpace (not sRGB)
      // This is usually handled by the loader, but let's ensure it
      materials.floorMaterial.normalMap.colorSpace = '' as any // Linear/default
      
      // Boost normal map intensity significantly for more visible surface detail
      // Values 1-2 = subtle, 3-5 = noticeable, 5+ = exaggerated
      materials.floorMaterial.normalScale = new Vector2(3.0, 3.0)
      
      console.log('Normal scale set to:', materials.floorMaterial.normalScale)
    }

    // Ensure good roughness for realistic flooring (less shiny, more matte)
    // Only set if not already configured from the GLB
    if (materials.floorMaterial.roughness < 0.3) {
      materials.floorMaterial.roughness = 0.6
    }

    // Ensure metalness is low for non-metallic floors
    if (materials.floorMaterial.metalness > 0.3) {
      materials.floorMaterial.metalness = 0.0
    }
  }, [materials])

  // Apply ambient light as color tint (affects baked materials too)
  useEffect(() => {
    if (materials.floorMaterial) {
      // Apply ambient light as a tint - this affects both textured and untextured materials
      // For textured materials, this creates a subtle warm/cool shift based on ambient color
      const color = new Color(ambientColor)
      // Scale the color - keep it bright enough to show texture but allow tinting
      color.multiplyScalar(Math.max(0.8, scale))
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
