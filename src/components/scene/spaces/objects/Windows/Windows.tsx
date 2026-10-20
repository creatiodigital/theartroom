import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { DoubleSide, Mesh, BufferGeometry } from 'three'
import type { RootState } from '@/redux/store'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import { countNodes } from '@/components/scene/spaces/objects/nodeIndices'
import { useBakedLook } from '@/components/scene/bake/bakedLook'

const DEFAULT_WINDOW_LIGHT_INTENSITY = 4.0
const DEFAULT_WINDOW_LIGHT_COLOR = '#ffffff'
// The off-white every frame had before the color became editable.
export const DEFAULT_WINDOW_FRAME_COLOR = '#e8e8e8'

interface WindowsProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  frameCount?: number
  glassCount?: number
  handleCount?: number
  windowRefs?: React.RefObject<Mesh | null>[]
  glassRefs?: React.RefObject<Mesh | null>[]
}

const Windows: React.FC<WindowsProps> = ({
  nodes,
  frameCount,
  glassCount,
  handleCount,
  windowRefs,
  glassRefs,
}) => {
  const storedLightIntensity = useSelector(
    (state: RootState) => state.exhibition.windowLightIntensity ?? DEFAULT_WINDOW_LIGHT_INTENSITY,
  )
  const storedLightColor = useSelector(
    (state: RootState) => state.exhibition.windowLightColor ?? DEFAULT_WINDOW_LIGHT_COLOR,
  )
  const storedTransparency = useSelector(
    (state: RootState) => state.exhibition.windowTransparency ?? false,
  )
  // AR-161: in the baked look the window is the space's — glass always on (no "show sky" view),
  // its color and brightness the space's daylight.
  const look = useBakedLook()
  const windowLightIntensity = look.baked ? look.space.windowIntensity : storedLightIntensity
  const windowLightColor = look.baked ? look.space.windowColor : storedLightColor
  const windowTransparency = look.baked ? false : storedTransparency
  const windowFrameColor = useSelector(
    (state: RootState) => state.exhibition.windowFrameColor ?? DEFAULT_WINDOW_FRAME_COLOR,
  )

  // Tinted colors that respond to ambient light (NOT for glass)
  const tintedFrame = useAmbientLightColor(windowFrameColor)
  const tintedHandle = useAmbientLightColor('#8d8d8a')

  // Counts come from the GLB unless a space deliberately overrides them.
  const frames = frameCount ?? countNodes(nodes, 'windowFrame')
  const glass = glassCount ?? countNodes(nodes, 'windowGlass')
  const handles = handleCount ?? countNodes(nodes, 'windowHandle')
  // AR-161: `windowLight` planes are daylight openings modelled in Blender (the sky behind a
  // window, a light well): in the baked look drawn as daylight and baked as light sources. Today's
  // look never draws them.
  const daylightPanels = look.baked ? countNodes(nodes, 'windowLight') : 0
  const panelsArray = useMemo(() => Array.from({ length: daylightPanels }), [daylightPanels])

  const framesArray = useMemo(() => Array.from({ length: frames }), [frames])
  const glassArray = useMemo(() => Array.from({ length: glass }), [glass])
  const handlesArray = useMemo(() => Array.from({ length: handles }), [handles])

  return (
    <>
      {/* Window Glass - always render for collision, hide visually when transparent */}
      {glassArray.map((_, i) => {
        const glassNode = nodes[`windowGlass${i}`]
        if (!glassNode) return null
        return (
          <mesh
            key={`glass-${i}`}
            ref={glassRefs?.[i]}
            name={`windowGlass${i}`}
            geometry={glassNode.geometry}
            visible={!windowTransparency}
            position={[
              glassNode.position.x,
              glassNode.position.y,
              glassNode.position.z - 0.05, // Push back behind frames
            ]}
            rotation={glassNode.rotation}
            scale={glassNode.scale}
          >
            <meshStandardMaterial
              color={windowLightColor}
              emissive={windowLightColor}
              emissiveIntensity={windowLightIntensity * 0.3}
              envMapIntensity={0}
            />
          </mesh>
        )
      })}

      {panelsArray.map((_, i) => {
        const panelNode = nodes[`windowLight${i}`]
        if (!panelNode) return null
        return (
          <mesh
            key={`daylight-${i}`}
            name={`windowLight${i}`}
            geometry={panelNode.geometry}
            position={panelNode.position}
            rotation={panelNode.rotation}
            scale={panelNode.scale}
          >
            <meshStandardMaterial
              color={windowLightColor}
              emissive={windowLightColor}
              emissiveIntensity={windowLightIntensity * 0.3}
              envMapIntensity={0}
              side={DoubleSide}
            />
          </mesh>
        )
      })}

      {/* Window Frames */}
      {framesArray.map((_, i) => {
        const frameNode = nodes[`windowFrame${i}`]
        if (!frameNode) return null
        return (
          <mesh
            key={`frame-${i}`}
            ref={windowRefs?.[i]}
            name={`windowFrame${i}`}
            geometry={frameNode.geometry}
            position={frameNode.position}
            rotation={frameNode.rotation}
            scale={frameNode.scale}
          >
            <meshStandardMaterial color={tintedFrame} roughness={0.5} />
          </mesh>
        )
      })}

      {/* Window Handles */}
      {handlesArray.map((_, i) => {
        const handleNode = nodes[`windowHandle${i}`]
        if (!handleNode) return null
        return (
          <mesh
            key={`handle-${i}`}
            name={`windowHandle${i}`}
            geometry={handleNode.geometry}
            position={handleNode.position}
            rotation={handleNode.rotation}
            scale={handleNode.scale}
          >
            <meshStandardMaterial color={tintedHandle} roughness={0.3} metalness={0.9} />
          </mesh>
        )
      })}
    </>
  )
}

export default Windows
