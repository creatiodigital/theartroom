import { useGLTF } from '@react-three/drei'
import { Mesh, BufferGeometry, MeshStandardMaterial } from 'three'
import type { GLTF } from 'three-stdlib'

import { PlasterCeiling } from '@/components/scene/spaces/objects/Ceiling/PlasterCeiling'
import { ReflectiveFloor } from '@/components/scene/spaces/objects/Floor/ReflectiveFloor'
import { PlasterWall } from '@/components/scene/spaces/objects/Wall/PlasterWall'
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

const BaseSpace: React.FC<BaseSpaceProps> = ({ wallRefs, ...props }) => {
  const { nodes } = useGLTF('/assets/spaces/base.glb?v=12') as unknown as GLTFResult

  return (
    <group {...props} dispose={null}>
      <Lights />
      <Effects />
      {nodes.floor && <ReflectiveFloor geometry={nodes.floor.geometry} textureRepeat={0.5} />}
      {nodes.ceiling && <PlasterCeiling geometry={nodes.ceiling.geometry} textureRepeat={2} />}
      {nodes.wall0 && (
        <PlasterWall
          i={0}
          wallRef={wallRefs[0]}
          geometry={nodes.wall0.geometry}
          textureRepeat={2}
        />
      )}
    </group>
  )
}

export default BaseSpace
