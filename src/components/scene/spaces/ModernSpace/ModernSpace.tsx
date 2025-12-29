import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Mesh, MeshStandardMaterial, BufferGeometry, Material } from 'three'
import type { GLTF } from 'three-stdlib'

import { ArtObjects } from '@/components/scene/spaces/objects/ArtObjects'
import { PlasterCeiling } from '@/components/scene/spaces/objects/Ceiling/PlasterCeiling'
import { CeilingGlass } from '@/components/scene/spaces/objects/CeilingGlass'
import { ReflectiveFloor } from '@/components/scene/spaces/objects/Floor/ReflectiveFloor'
import { Placeholder } from '@/components/scene/spaces/objects/Placeholder'


import { PlasterWall } from '@/components/scene/spaces/objects/Wall/PlasterWall'
import { addWall } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import { Lights } from './lights'
import { Effects } from '@/components/scene/spaces/objects/Effects'
import { reelMaterial, topMaterial, rectLampMaterial } from './materials'

type GLTFResult = GLTF & {
  nodes: {
    floor: Mesh & { geometry: BufferGeometry; material: MeshStandardMaterial }
    ceiling: Mesh & { geometry: BufferGeometry; material: MeshStandardMaterial }
    top: Mesh & { geometry: BufferGeometry }
    wall0: Mesh & { geometry: BufferGeometry; material: MeshStandardMaterial }
    [key: string]: Mesh
  }
}

type ModernSpaceProps = React.ComponentProps<'group'> & {
  wallRefs: React.RefObject<Mesh | null>[]
  onPlaceholderClick: (wallId: string) => void
  artworks: TArtwork[]
}

const ModernSpace: React.FC<ModernSpaceProps> = ({ wallRefs, ...props }) => {
  const { nodes } = useGLTF('/assets/spaces/modern.glb?v=5') as unknown as GLTFResult

  const dispatch = useDispatch()
  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)

  const wallsArray = useMemo(() => Array.from({ length: 1 }), [])
  const placeholdersArray = useMemo(() => Array.from({ length: 4 }), [])



  useEffect(() => {
    placeholdersArray.forEach((_, i) => {
      const wallNode = nodes[`placeholder${i}`]
      if (wallNode) {
        dispatch(addWall({ id: wallNode.uuid }))
      }
    })
  }, [nodes, dispatch, placeholdersArray])

  return (
    <group {...props} dispose={null}>
      <Lights />
      <Effects />
      {nodes.floor && (
        <ReflectiveFloor 
          geometry={nodes.floor.geometry}
          textureRepeat={1}
        />
      )}
      {nodes.ceiling && (
        <PlasterCeiling 
          geometry={nodes.ceiling.geometry}
          textureRepeat={4}
        />
      )}
      {nodes.glass && (
        <CeilingGlass 
          geometry={nodes.glass.geometry} 
          material={(nodes.glass.material as Material) || topMaterial} 
        />
      )}
      {wallsArray.map((_, i) => {
        const wallNode = nodes[`wall${i}`]
        if (!wallNode) return null
        return (
          <PlasterWall 
            key={i} 
            i={i} 
            wallRef={wallRefs[i]} 
            geometry={wallNode.geometry}
            textureRepeat={4}
          />
        )
      })}
      {isPlaceholdersShown &&
        placeholdersArray.map((_, i) => <Placeholder key={i} i={i} nodes={nodes} />)}
      {nodes.rect1 && (
        <mesh
          name="rect1"
          geometry={nodes.rect1.geometry}
          material={rectLampMaterial}
        />
      )}
      {nodes.reel0 && (
        <mesh
          name="reel0"
          castShadow
          receiveShadow
          geometry={nodes.reel0.geometry}
          material={reelMaterial}
        />
      )}
      <ArtObjects />
    </group>
  )
}

export default ModernSpace
