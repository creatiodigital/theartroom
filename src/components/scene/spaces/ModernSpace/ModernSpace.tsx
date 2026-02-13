import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Mesh, MeshStandardMaterial, BufferGeometry } from 'three'
import type { GLTF } from 'three-stdlib'

import { ArtObjects } from '@/components/scene/spaces/objects/ArtObjects'
import { PlasterCeiling } from '@/components/scene/spaces/objects/Ceiling/PlasterCeiling'
import { CeilingGlass } from '@/components/scene/spaces/objects/CeilingGlass'
import { CeilingLamps } from '@/components/scene/spaces/objects/CeilingLamps'
import { ReflectiveFloor } from '@/components/scene/spaces/objects/Floor/ReflectiveFloor'
import { Placeholder } from '@/components/scene/spaces/objects/Placeholder'

import { PlasterWall } from '@/components/scene/spaces/objects/Wall/PlasterWall'
import { addWall } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import { Lights } from './lights'
import { Effects } from '@/components/scene/spaces/objects/Effects'
import { reelMaterial } from './materials'

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
      {nodes.floor &&
        (() => {
          // Calculate actual floor surface Y from geometry bounding box
          nodes.floor.geometry.computeBoundingBox()
          const floorSurfaceY =
            nodes.floor.position.y + (nodes.floor.geometry.boundingBox?.max.y ?? 0)
          return (
            <>
              {/* Hide original floor but use its computed surface position for the reflective floor */}
              <primitive object={nodes.floor} visible={false} />
              <ReflectiveFloor
                position={[nodes.floor.position.x, floorSurfaceY, nodes.floor.position.z]}
              />
            </>
          )
        })()}
      {nodes.ceiling && <PlasterCeiling geometry={nodes.ceiling.geometry} textureRepeat={4} />}
      {nodes.top && <CeilingGlass geometry={nodes.top.geometry} />}
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
      {nodes.rectlamp0 && <CeilingLamps geometry={nodes.rectlamp0.geometry} />}
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
