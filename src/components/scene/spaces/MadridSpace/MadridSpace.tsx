import { useGLTF, useTexture, SoftShadows, BakeShadows, Preload } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Mesh, BufferGeometry, MeshStandardMaterial, SRGBColorSpace, Color } from 'three'
import type { GLTF } from 'three-stdlib'

import { ArtObjects } from '@/components/scene/spaces/objects/ArtObjects'
import { Ceiling } from '@/components/scene/spaces/objects/Ceiling'
import { ReflectiveFloor } from '@/components/scene/spaces/objects/Floor/ReflectiveFloor'
import { ParisWindow } from '@/components/scene/spaces/objects/ParisWindow'
import { Placeholder } from '@/components/scene/spaces/objects/Placeholder'
import { Radiator } from '@/components/scene/spaces/objects/Radiator'
import RoundLamp from '@/components/scene/spaces/objects/RoundLamp/RoundLamp'
import { SingleSocket } from '@/components/scene/spaces/objects/SingleSocket'
import { Switch } from '@/components/scene/spaces/objects/Switch'
import { Wall } from '@/components/scene/spaces/objects/Wall'
import { Effects } from '@/components/scene/spaces/objects/Effects'

import { useAmbientLight } from '@/hooks/useAmbientLight'
import { addWall, setInitialCameraFromNode } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import { Lights } from './lights'

// Preload baked textures at module scope
useTexture.preload('/assets/spaces/madrid/textures/mwall1.jpg')
useTexture.preload('/assets/spaces/madrid/textures/mceiling1.jpg')

type GLTFResult = GLTF & {
  nodes: {
    floor0: Mesh & { geometry: BufferGeometry; material: MeshStandardMaterial }
    ceiling0: Mesh & { geometry: BufferGeometry; material: MeshStandardMaterial }
    wall0: Mesh & { geometry: BufferGeometry; material: MeshStandardMaterial }
    [key: string]: Mesh
  }
}

type MadridSpaceProps = React.ComponentProps<'group'> & {
  wallRefs: React.RefObject<Mesh | null>[]
  windowRefs: React.RefObject<Mesh | null>[]
  glassRefs: React.RefObject<Mesh | null>[]
  onPlaceholderClick: (wallId: string) => void
  artworks: TArtwork[]
}

const MadridSpace: React.FC<MadridSpaceProps> = ({ wallRefs, windowRefs, glassRefs, ...props }) => {
  const { nodes } = useGLTF('/assets/spaces/madrid/madrid7.glb') as unknown as GLTFResult

  const dispatch = useDispatch()
  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)

  // Ambient light for wall/ceiling tinting
  const { ambientColor, scale } = useAmbientLight()

  // Independent wall & ceiling colors
  const wallColor = useSelector((state: RootState) => state.exhibition.wallColor ?? '#ffffff')
  const ceilingColor = useSelector((state: RootState) => state.exhibition.ceilingColor ?? '#ffffff')

  // Load external baked textures (single suspension point)
  const [wallTexture, ceilingTexture] = useTexture([
    '/assets/spaces/madrid/textures/mwall1.jpg',
    '/assets/spaces/madrid/textures/mceiling1.jpg',
  ])

  // Configure textures
  useMemo(() => {
    wallTexture.colorSpace = SRGBColorSpace
    wallTexture.flipY = false
    ceilingTexture.colorSpace = SRGBColorSpace
    ceilingTexture.flipY = false
  }, [wallTexture, ceilingTexture])

  // Create materials with baked textures
  const wallMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.9,
      metalness: 0,
      side: 2,
    })
  }, [wallTexture])

  const ceilingMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      map: ceilingTexture,
      roughness: 0.9,
      metalness: 0,
      side: 2,
    })
  }, [ceilingTexture])

  // Apply ambient light tinting + independent wall/ceiling color
  useEffect(() => {
    const ambientTint = new Color(ambientColor).multiplyScalar(scale)

    wallMaterial.color = ambientTint.clone().multiply(new Color(wallColor))
    ceilingMaterial.color = ambientTint.clone().multiply(new Color(ceilingColor))
  }, [wallMaterial, ceilingMaterial, ambientColor, scale, wallColor, ceilingColor])

  // Arrays for iterating over indexed meshes
  const placeholdersArray = useMemo(() => Array.from({ length: 4 }), [])

  // Register placeholders with Redux
  useEffect(() => {
    placeholdersArray.forEach((_, i) => {
      const placeholderNode = nodes[`placeholder${i}`]
      if (placeholderNode) {
        dispatch(addWall({ id: placeholderNode.uuid }))
      }
    })
  }, [nodes, dispatch, placeholdersArray])

  // Extract initial camera position and direction from initialPoint0 node
  useLayoutEffect(() => {
    const initialNode = nodes.initialPoint0
    if (initialNode) {
      const pos: [number, number] = [initialNode.position.x, initialNode.position.z]

      let dir: [number, number] = [0, -1]
      if (initialNode.geometry) {
        const normalAttr = initialNode.geometry.attributes.normal
        if (normalAttr && normalAttr.count > 0) {
          const nx = -normalAttr.getX(0)
          const nz = -normalAttr.getZ(0)
          const len = Math.sqrt(nx * nx + nz * nz)
          if (len > 0.001) {
            dir = [nx / len, nz / len]
          }
        }
      }

      dispatch(setInitialCameraFromNode({ position: pos, direction: dir }))
    }
  }, [nodes, dispatch])

  return (
    <group {...props} dispose={null}>
      <Lights />
      <SoftShadows size={10} samples={16} focus={0} />
      <BakeShadows />
      <Effects enabled={true} />

      {/* Floor */}
      {nodes.floor0 &&
        (() => {
          nodes.floor0.geometry.computeBoundingBox()
          const bb = nodes.floor0.geometry.boundingBox!
          const sx = nodes.floor0.scale.x
          const sy = nodes.floor0.scale.y
          const sz = nodes.floor0.scale.z
          const centerX = nodes.floor0.position.x + ((bb.max.x + bb.min.x) / 2) * sx
          const centerZ = nodes.floor0.position.z + ((bb.max.z + bb.min.z) / 2) * sz
          const floorSurfaceY = nodes.floor0.position.y + (bb.max.y ?? 0) * sy
          const floorWidth = (bb.max.x - bb.min.x) * sx
          const floorDepth = (bb.max.z - bb.min.z) * sz
          return (
            <>
              <primitive object={nodes.floor0} visible={false} />
              <ReflectiveFloor
                position={[centerX, floorSurfaceY, centerZ]}
                width={floorWidth}
                depth={floorDepth}
              />
            </>
          )
        })()}

      {/* Ceiling */}
      {nodes.ceiling0 && (
        <Ceiling
          geometry={nodes.ceiling0.geometry}
          material={ceilingMaterial}
          position={nodes.ceiling0.position.toArray() as [number, number, number]}
          rotation={[nodes.ceiling0.rotation.x, nodes.ceiling0.rotation.y, nodes.ceiling0.rotation.z]}
          scale={nodes.ceiling0.scale.toArray() as [number, number, number]}
        />
      )}

      {/* Wall */}
      {nodes.wall0 && (
        <Wall
          i={0}
          wallRef={wallRefs[0]}
          geometry={nodes.wall0.geometry}
          material={wallMaterial}
          position={nodes.wall0.position.toArray() as [number, number, number]}
          rotation={[nodes.wall0.rotation.x, nodes.wall0.rotation.y, nodes.wall0.rotation.z]}
          scale={nodes.wall0.scale.toArray() as [number, number, number]}
        />
      )}

      {/* Windows (2 windows: 4 frames, 2 glass panes) */}
      <ParisWindow nodes={nodes} frameCount={4} glassCount={2} windowRefs={windowRefs} glassRefs={glassRefs} />

      {/* Radiators */}
      <Radiator nodes={nodes} count={2} />

      {/* Round Lamps (17 lamps) */}
      <RoundLamp nodes={nodes} count={17} />

      {/* Light Switch */}
      <Switch nodes={nodes} count={1} />

      {/* Single Sockets */}
      <SingleSocket nodes={nodes} count={2} />

      {/* Invisible Door (collision barrier) */}
      {nodes.invisibleDoor0 && (
        <mesh
          ref={wallRefs[1]}
          name="invisibleDoor0"
          geometry={nodes.invisibleDoor0.geometry}
          position={nodes.invisibleDoor0.position}
          rotation={nodes.invisibleDoor0.rotation}
          scale={nodes.invisibleDoor0.scale}
          visible={false}
        />
      )}

      {/* Placeholders */}
      {isPlaceholdersShown &&
        placeholdersArray.map((_, i) => <Placeholder key={i} i={i} nodes={nodes} />)}

      {/* Initial Point (reference position) */}
      {nodes.initialPoint0 && <primitive object={nodes.initialPoint0} visible={false} />}

      {/* Artworks */}
      <ArtObjects />

      <Preload all />
    </group>
  )
}

export default MadridSpace
