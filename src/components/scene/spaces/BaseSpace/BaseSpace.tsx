import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { Mesh, BufferGeometry, MeshStandardMaterial, Color, DoubleSide } from 'three'
import type { GLTF } from 'three-stdlib'

import { Ceiling } from '@/components/scene/spaces/objects/Ceiling'
import { Floor } from '@/components/scene/spaces/objects/Floor'
import { Wall } from '@/components/scene/spaces/objects/Wall'
import { Lights } from './lights'
import { Effects } from '@/components/scene/spaces/objects/Effects'

type GLTFResult = GLTF & {
  nodes: {
    floor: Mesh & { geometry: BufferGeometry; material: MeshStandardMaterial }
    ceiling: Mesh & { geometry: BufferGeometry; material: MeshStandardMaterial }
    wall0: Mesh & { geometry: BufferGeometry; material: MeshStandardMaterial }
    [key: string]: Mesh
  }
}

type BaseSpaceProps = React.ComponentProps<'group'> & {
  wallRefs: React.RefObject<Mesh | null>[]
}

const BaseSpace: React.FC<BaseSpaceProps> = ({
  wallRefs,
  ...props
}) => {
  const { nodes } = useGLTF('/assets/spaces/base.glb?v=12') as unknown as GLTFResult

  // Ensure wall material exists (fallback if not in GLB)
  const wallMaterial = useMemo(() => {
    if (nodes.wall0?.material) {
      return nodes.wall0.material as MeshStandardMaterial
    }
    return new MeshStandardMaterial({
      color: new Color('#f5f5f5'),
      roughness: 0.9,
      metalness: 0,
    })
  }, [nodes])

  // Ensure ceiling material is double-sided
  useMemo(() => {
    if (nodes.ceiling?.material) {
      (nodes.ceiling.material as MeshStandardMaterial).side = DoubleSide
    }
  }, [nodes])

  return (
    <group {...props} dispose={null}>
      <Lights />
      <Effects />
      {nodes.floor && (
        <Floor 
          geometry={nodes.floor.geometry} 
          material={nodes.floor.material as MeshStandardMaterial} 
        />
      )}
      {nodes.ceiling && (
        <Ceiling 
          geometry={nodes.ceiling.geometry} 
          material={nodes.ceiling.material as MeshStandardMaterial} 
        />
      )}
      {nodes.wall0 && (
        <Wall 
          i={0} 
          wallRef={wallRefs[0]} 
          geometry={nodes.wall0.geometry} 
          material={wallMaterial} 
        />
      )}
    </group>
  )
}

export default BaseSpace
