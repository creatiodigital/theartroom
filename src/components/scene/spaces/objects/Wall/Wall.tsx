import { useEffect, useMemo } from 'react'
import { SRGBColorSpace, Mesh, BufferGeometry, MeshStandardMaterial, Texture, Color } from 'three'

import { useAmbientLight } from '@/hooks/useAmbientLight'

interface WallProps {
  i: number
  wallRef: React.Ref<Mesh>
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  materials: {
    wallMaterial?: MeshStandardMaterial & {
      map?: Texture
    }
  }
}

const Wall: React.FC<WallProps> = ({ i, wallRef, nodes, materials }) => {
  const { ambientColor, scale } = useAmbientLight()

  useMemo(() => {
    if (materials.wallMaterial?.map) {
      materials.wallMaterial.map.colorSpace = SRGBColorSpace
    }
  }, [materials])

  // Apply ambient light as color multiplier
  useEffect(() => {
    if (materials.wallMaterial) {
      const color = new Color(ambientColor)
      color.multiplyScalar(scale)
      materials.wallMaterial.color = color
    }
  }, [materials, ambientColor, scale])

  return (
    <mesh
      name={`wall${i}`}
      ref={wallRef}
      castShadow
      receiveShadow
      geometry={nodes[`wall${i}`]?.geometry}
      material={materials.wallMaterial}
    />
  )
}

export default Wall
