import { Suspense, useCallback, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { DoubleSide, Mesh, BufferGeometry } from 'three'
import type { RootState } from '@/redux/store'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import { countNodes } from '@/components/scene/spaces/objects/nodeIndices'
import { useBakedLook } from '@/components/scene/bake/bakedLook'
import { useBakePage } from '@/components/scene/bake/bakePage'
import { spaceLooks } from '@/lib/bake/spaceLooks'

import ExteriorView, { exteriorShown, panelsBehindGlass } from './ExteriorView'
import { frostedGlassPatch } from './frostedGlass'
import GlassReflection, { glassReflectionShown } from './GlassReflection'

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
  // AR-161: in the baked look the glass is always on (no "show sky" view) at the space's daylight
  // brightness. AR-169: its color is the artist's — and so the color of the daylight the bake
  // brings into the room (`brightenWindows` reads it here; it is in the fingerprint).
  const look = useBakedLook()
  const windowLightIntensity = look.baked ? look.space.windowIntensity : storedLightIntensity
  const windowLightColor = storedLightColor
  const windowTransparency = look.baked ? false : storedTransparency
  // AR-169: in a baked room the glass shows frosted glass (`frostedGlass.ts`).
  const glassPatch = look.baked ? frostedGlassPatch : {}
  // AR-170 (`ExteriorView`): the street behind clear glass in every room of a baked space on the
  // visit and review pages, on screen only — never on the bake page, so no bake sees it. Also while
  // such a room is unbaked (its bake older than the model, or none yet), with the space's daylight:
  // every window shows a building (Eduardo tested the views that way on vienna16). Once the facade
  // has loaded the glass keeps its emissive (the daylight) but draws nothing; until then, or if it
  // never loads, the glass stays as it was.
  const bakePage = useBakePage()
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId)
  const spaceLook = look.baked ? look.space : spaceId ? spaceLooks[spaceId]?.look : undefined
  const exterior = useMemo(
    () => Boolean(spaceLook && bakePage && bakePage.mode !== 'bake' && exteriorShown()),
    [spaceLook, bakePage],
  )
  const [facadeLoaded, setFacadeLoaded] = useState(false)
  const onFacadeShown = useCallback(() => setFacadeLoaded(true), [])
  const street = exterior && facadeLoaded
  // The room reflected in the clear glass (`GlassReflection`), while the street shows.
  const reflection = useMemo(() => glassReflectionShown(), [])
  const hiddenPanels = useMemo(
    () => (street ? panelsBehindGlass(nodes) : new Set<number>()),
    [street, nodes],
  )
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
            // Where the model has it: in the middle of the frame, as real glass sits (owner
            // 2026-10-30). It was pushed 5 cm back (behind the frame) since the first Paris model —
            // the frame then shaded 3–10 % of the daylight near the window, and in Vienna, whose
            // side windows face x, the push slid their glass 5 cm sideways.
            position={glassNode.position}
            rotation={glassNode.rotation}
            scale={glassNode.scale}
          >
            <meshStandardMaterial
              color={windowLightColor}
              emissive={windowLightColor}
              emissiveIntensity={windowLightIntensity * 0.3}
              envMapIntensity={0}
              colorWrite={!street}
              depthWrite={!street}
              {...glassPatch}
            />
          </mesh>
        )
      })}

      {exterior && spaceLook && (
        <Suspense fallback={null}>
          <ExteriorView
            nodes={nodes}
            windowIntensity={spaceLook.windowIntensity}
            daylightGain={spaceLook.daylightGain}
            onShown={onFacadeShown}
          />
        </Suspense>
      )}
      {street && reflection && <GlassReflection nodes={nodes} />}

      {panelsArray.map((_, i) => {
        const panelNode = nodes[`windowLight${i}`]
        if (!panelNode) return null
        return (
          <mesh
            key={`daylight-${i}`}
            name={`windowLight${i}`}
            visible={!hiddenPanels.has(i)}
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
