import { useEffect, useMemo } from 'react'
import { SRGBColorSpace, Mesh, BufferGeometry, MeshStandardMaterial, MeshLambertMaterial, Color } from 'three'

import { useAmbientLight } from '@/hooks/useAmbientLight'

interface WallProps {
  i: number
  wallRef: React.Ref<Mesh>
  geometry: BufferGeometry
  material: MeshStandardMaterial | MeshLambertMaterial
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
}

const Wall: React.FC<WallProps> = ({
  i,
  wallRef,
  geometry,
  material,
  position,
  rotation,
  scale,
}) => {
  const { ambientColor, scale: ambientScale } = useAmbientLight()

  useMemo(() => {
    if (material?.map) {
      material.map.colorSpace = SRGBColorSpace
    }
  }, [material])

  // Apply ambient light as color multiplier
  useEffect(() => {
    if (material) {
      const color = new Color(ambientColor)
      color.multiplyScalar(ambientScale)
      material.color = color
    }
  }, [material, ambientColor, ambientScale])

  return (
    <mesh
      name={`wall${i}`}
      ref={wallRef}
      castShadow
      receiveShadow
      geometry={geometry}
      material={material}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  )
}

export default Wall
