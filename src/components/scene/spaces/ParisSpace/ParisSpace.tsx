import { useGLTF, useTexture, SoftShadows, BakeShadows, Preload } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Mesh, BufferGeometry, MeshStandardMaterial, SRGBColorSpace, Color } from 'three'
import type { GLTF } from 'three-stdlib'

import { ArtObjects } from '@/components/scene/spaces/objects/ArtObjects'
import { Ceiling } from '@/components/scene/spaces/objects/Ceiling'
import { Door } from '@/components/scene/spaces/objects/Door'
import { ReflectiveFloor } from '@/components/scene/spaces/objects/Floor/ReflectiveFloor'
import { ParisWindow } from '@/components/scene/spaces/objects/ParisWindow'
import { Placeholder } from '@/components/scene/spaces/objects/Placeholder'
import { Radiator } from '@/components/scene/spaces/objects/Radiator'
import { RecessedLamp } from '@/components/scene/spaces/objects/RecessedLamp'
import RoundLamp from '@/components/scene/spaces/objects/RoundLamp/RoundLamp'
import { SingleSocket } from '@/components/scene/spaces/objects/SingleSocket'
import { Switch } from '@/components/scene/spaces/objects/Switch'
import { TrackLamp } from '@/components/scene/spaces/objects/TrackLamp'
import { Wall } from '@/components/scene/spaces/objects/Wall'
import { Effects } from '@/components/scene/spaces/objects/Effects'

import { useAmbientLight } from '@/hooks/useAmbientLight'
import { addWall } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import { Lights } from './lights'

type GLTFResult = GLTF & {
  nodes: {
    floor0: Mesh & { geometry: BufferGeometry; material: MeshStandardMaterial }
    ceiling0: Mesh & { geometry: BufferGeometry; material: MeshStandardMaterial }
    wall0: Mesh & { geometry: BufferGeometry; material: MeshStandardMaterial }
    [key: string]: Mesh
  }
}

type ParisSpaceProps = React.ComponentProps<'group'> & {
  wallRefs: React.RefObject<Mesh | null>[]
  windowRefs: React.RefObject<Mesh | null>[]
  glassRefs: React.RefObject<Mesh | null>[]
  onPlaceholderClick: (wallId: string) => void
  artworks: TArtwork[]
}

const ParisSpace: React.FC<ParisSpaceProps> = ({ wallRefs, windowRefs, glassRefs, ...props }) => {
  const { nodes } = useGLTF('/assets/spaces/paris/paris10.glb?v=2') as unknown as GLTFResult

  const dispatch = useDispatch()
  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const ceilingLightMode = useSelector(
    (state: RootState) => state.exhibition.ceilingLightMode ?? 'track-plafond',
  )

  // Ambient light for wall/ceiling tinting
  const { ambientColor, scale } = useAmbientLight()

  // Independent wall & ceiling colors
  const wallColor = useSelector((state: RootState) => state.exhibition.wallColor ?? '#ffffff')
  const ceilingColor = useSelector((state: RootState) => state.exhibition.ceilingColor ?? '#ffffff')

  // Load external baked textures
  const wallTexture = useTexture('/assets/spaces/paris/textures/bakedWall8.jpg')
  const ceilingTexture = useTexture('/assets/spaces/paris/textures/bakedCeiling9.jpg')

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
          const floorSurfaceY = nodes.floor0.position.y + (bb.max.y ?? 0)
          const floorWidth = bb.max.x - bb.min.x
          const floorDepth = bb.max.z - bb.min.z
          return (
            <>
              <primitive object={nodes.floor0} visible={false} />
              <ReflectiveFloor
                position={[nodes.floor0.position.x, floorSurfaceY, nodes.floor0.position.z]}
                width={floorWidth}
                depth={floorDepth}
              />
            </>
          )
        })()}

      {/* Ceiling */}
      {nodes.ceiling0 && <Ceiling geometry={nodes.ceiling0.geometry} material={ceilingMaterial} />}

      {/* Wall */}
      {nodes.wall0 && (
        <Wall i={0} wallRef={wallRefs[0]} geometry={nodes.wall0.geometry} material={wallMaterial} />
      )}

      {/* Window */}
      <ParisWindow
        nodes={nodes}
        frameCount={2}
        handleCount={2}
        windowRefs={windowRefs}
        glassRefs={glassRefs}
      />

      {/* Door */}
      <Door nodes={nodes} doorFrameRef={wallRefs[1]} doorMainRef={wallRefs[2]} />

      {/* Radiator */}
      <Radiator nodes={nodes} radiatorRef={wallRefs[3]} />

      {/* Track Lamps - visible in 'track' and 'track-plafond' modes */}
      {(ceilingLightMode === 'track' || ceilingLightMode === 'track-plafond') && (
        <TrackLamp nodes={nodes} count={14} />
      )}

      {/* Recessed Lamps - visible only in 'track-plafond' mode, spotlights disabled when track lamps present */}
      {ceilingLightMode === 'track-plafond' && (
        <RecessedLamp nodes={nodes} count={6} disableSpotlights />
      )}

      {/* Round Lamps - visible only in 'plafond' mode */}
      {ceilingLightMode === 'plafond' && <RoundLamp nodes={nodes} count={15} />}

      {/* Single Sockets */}
      <SingleSocket nodes={nodes} count={2} />

      {/* Switches */}
      <Switch nodes={nodes} count={2} />

      {/* Placeholders */}
      {isPlaceholdersShown &&
        placeholdersArray.map((_, i) => <Placeholder key={i} i={i} nodes={nodes} />)}

      {/* Artworks */}
      <ArtObjects />

      <Preload all />
    </group>
  )
}

export default ParisSpace
