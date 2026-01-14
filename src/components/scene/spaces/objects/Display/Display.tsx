import { useMemo, useRef, useCallback } from 'react'
import { useTexture } from '@react-three/drei'
import { useDispatch, useSelector } from 'react-redux'
import { DoubleSide, MeshStandardMaterial, SRGBColorSpace, Vector3, Quaternion } from 'three'
import type { ThreeEvent } from '@react-three/fiber'

import { Frame } from '@/components/scene/spaces/objects/Frame'
import { Passepartout } from '@/components/scene/spaces/objects/Passepartout'
import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import { showArtworkPanel } from '@/redux/slices/dashboardSlice'
import { setCurrentArtwork, setFocusTarget } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { RuntimeArtwork } from '@/utils/artworkTransform'

type DisplayProps = {
  artwork: RuntimeArtwork
}

type ArtworkImageProps = {
  url: string
  width: number
  height: number
}

const ArtworkImage = ({ url, width, height }: ArtworkImageProps) => {
  const texture = useTexture(url)
  texture.colorSpace = SRGBColorSpace

  return (
    <mesh castShadow receiveShadow renderOrder={2}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={texture}
        side={DoubleSide}
        roughness={1}
        metalness={0}
        toneMapped={true}
      />
    </mesh>
  )
}

// Constants for click detection
const CLICK_MAX_DISTANCE = 5 // Max pixels of mouse movement to qualify as click
const CLICK_MAX_DURATION = 300 // Max ms between pointer down and up for a click
const DOUBLE_CLICK_DELAY = 250 // Delay to wait for potential double-click

const Display = ({ artwork }: DisplayProps) => {
  const {
    position,
    quaternion,
    width,
    height,
    showArtworkInformation,
    imageUrl,
    showFrame,
    frameColor,
    frameThickness,
    showPassepartout,
    passepartoutColor,
    passepartoutThickness,
  } = artwork

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)
  const dispatch = useDispatch()

  // Refs for click detection
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const pointerDownTime = useRef<number>(0)
  const singleClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Use the ambient light hook for frame and passepartout colors
  const frameAmbientColor = useAmbientLightColor(frameColor ?? '#ffffff')
  const passepartoutAmbientColor = useAmbientLightColor(passepartoutColor ?? '#ffffff')

  // Calculate the normal vector from artwork's quaternion (facing direction)
  const getNormalFromQuaternion = useCallback((q: Quaternion): Vector3 => {
    // Default plane faces +Z, apply quaternion to get actual facing direction
    const normal = new Vector3(0, 0, 1)
    normal.applyQuaternion(q)
    return normal
  }, [])

  // Handle single click for focus (and update panel info if panel is open)
  const handleSingleClick = useCallback(() => {
    if (!isPlaceholdersShown && quaternion && position) {
      const normal = getNormalFromQuaternion(quaternion)
      dispatch(setFocusTarget({
        artworkId: artwork.id,
        position: { x: position.x, y: position.y, z: position.z },
        normal: { x: normal.x, y: normal.y, z: normal.z },
        width: width || 1,
        height: height || 1,
      }))
      
      // If the panel is already open, also update the current artwork info
      if (isArtworkPanelOpen) {
        dispatch(setCurrentArtwork(artwork.id))
      }
    }
  }, [dispatch, artwork.id, position, quaternion, width, height, isPlaceholdersShown, isArtworkPanelOpen, getNormalFromQuaternion])

  // Handle double click for info panel (existing behavior)
  const handleDoubleClick = useCallback(() => {
    // Cancel any pending single-click action
    if (singleClickTimeout.current) {
      clearTimeout(singleClickTimeout.current)
      singleClickTimeout.current = null
    }
    
    if (!isPlaceholdersShown && showArtworkInformation) {
      dispatch(showArtworkPanel())
      dispatch(setCurrentArtwork(artwork.id))
    }
  }, [dispatch, artwork.id, isPlaceholdersShown, showArtworkInformation])

  // Pointer down - start tracking (and clear any pending single-click to support double-click)
  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    // Clear any pending single-click timeout (this is the start of a potential double-click)
    if (singleClickTimeout.current) {
      clearTimeout(singleClickTimeout.current)
      singleClickTimeout.current = null
    }
    pointerDownPos.current = { x: event.clientX, y: event.clientY }
    pointerDownTime.current = Date.now()
  }, [])

  // Pointer up - check if it qualifies as a click
  const handlePointerUp = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!pointerDownPos.current) return

    const dx = event.clientX - pointerDownPos.current.x
    const dy = event.clientY - pointerDownPos.current.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const duration = Date.now() - pointerDownTime.current

    // Reset tracking
    pointerDownPos.current = null

    // Check if this qualifies as a click (minimal movement + short duration)
    if (distance < CLICK_MAX_DISTANCE && duration < CLICK_MAX_DURATION) {
      // Delay single-click action to see if a double-click follows
      singleClickTimeout.current = setTimeout(() => {
        handleSingleClick()
        singleClickTimeout.current = null
      }, DOUBLE_CLICK_DELAY)
    }
  }, [handleSingleClick])

  const planeWidth = width || 1
  const planeHeight = height || 1

  // Frame material with ambient light applied
  const frameMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: frameAmbientColor,
      roughness: 0.3,
      metalness: 0.1,
    })
  }, [frameAmbientColor])

  // Passepartout material with ambient light applied
  const passepartoutMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: passepartoutAmbientColor,
      roughness: 1,
    })
  }, [passepartoutAmbientColor])

  const frameT = (showFrame ? frameThickness?.value : 0) || 0
  const passepartoutT = (showPassepartout ? passepartoutThickness?.value : 0) || 0

  const innerWidth = planeWidth - (frameT + passepartoutT) / 50
  const innerHeight = planeHeight - (frameT + passepartoutT) / 50

  return (
    <group
      position={position}
      quaternion={quaternion}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <mesh renderOrder={1}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {!imageUrl && (
        <mesh renderOrder={2}>
          <planeGeometry args={[innerWidth, innerHeight]} />
          <meshBasicMaterial color="white" side={DoubleSide} />
        </mesh>
      )}

      {imageUrl && <ArtworkImage url={imageUrl} width={innerWidth} height={innerHeight} />}

      {showFrame && frameThickness?.value && (
        <Frame
          width={planeWidth}
          height={planeHeight}
          thickness={frameThickness.value / 100}
          material={frameMaterial}
        />
      )}

      {showPassepartout && passepartoutThickness?.value && frameThickness?.value && (
        <Passepartout
          width={planeWidth - frameThickness.value / 50}
          height={planeHeight - frameThickness.value / 50}
          thickness={passepartoutThickness.value / 100}
          material={passepartoutMaterial}
        />
      )}
    </group>
  )
}

export default Display

