import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  DoubleSide,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
  Quaternion,
  TextureLoader,
  Texture,
} from 'three'
import type { ThreeEvent } from '@react-three/fiber'

import { Frame } from '@/components/scene/spaces/objects/Frame'
import { Passepartout } from '@/components/scene/spaces/objects/Passepartout'
import { ShadowDecal } from '@/components/scene/spaces/objects/ShadowDecal'
import { Support } from '@/components/scene/spaces/objects/Support'
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

// Placeholder shown while texture loads
const ImagePlaceholder = ({ width, height }: { width: number; height: number }) => (
  <mesh renderOrder={2}>
    <planeGeometry args={[width, height]} />
    <meshBasicMaterial color="#f0f0f0" side={DoubleSide} />
  </mesh>
)

// Custom hook to load blob URLs directly with TextureLoader
const useBlobTexture = (url: string): Texture | null => {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    if (!url || !url.startsWith('blob:')) {
      setTexture(null)
      return
    }

    const loader = new TextureLoader()
    loader.load(
      url,
      (loadedTexture) => {
        loadedTexture.colorSpace = SRGBColorSpace
        setTexture(loadedTexture)
      },
      undefined,
      (error) => {
        console.warn('Failed to load blob texture:', error)
        setTexture(null)
      },
    )

    return () => {
      if (texture) {
        texture.dispose()
      }
    }
  }, [url])

  return texture
}

// Apply "background-size: cover" style UV mapping to a texture.
// Crops and centers the texture so it fills the plane without distortion.
const applyCoverUVs = (texture: Texture, planeWidth: number, planeHeight: number) => {
  const imgAspect = texture.image.width / texture.image.height
  const planeAspect = planeWidth / planeHeight

  if (imgAspect > planeAspect) {
    // Image is wider than plane — crop sides
    const scale = planeAspect / imgAspect
    texture.repeat.set(scale, 1)
    texture.offset.set((1 - scale) / 2, 0)
  } else {
    // Image is taller than plane — crop top/bottom
    const scale = imgAspect / planeAspect
    texture.repeat.set(1, scale)
    texture.offset.set(0, (1 - scale) / 2)
  }
}

// Component for blob URL images (uses custom loader)
const BlobImage = ({ url, width, height }: ArtworkImageProps) => {
  const texture = useBlobTexture(url)
  const ambientColor = useAmbientLightColor('#ffffff', 1.0)

  if (!texture) {
    return <ImagePlaceholder width={width} height={height} />
  }

  applyCoverUVs(texture, width, height)

  return (
    <mesh castShadow receiveShadow renderOrder={2}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} color={ambientColor} side={DoubleSide} />
    </mesh>
  )
}

// Custom hook to load regular URL textures with error handling
const useRegularTexture = (url: string): Texture | null => {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    if (!url || url === '') {
      setTexture(null)
      return
    }

    let disposed = false
    const loader = new TextureLoader()

    loader.load(
      url,
      (loadedTexture) => {
        if (!disposed) {
          loadedTexture.colorSpace = SRGBColorSpace
          setTexture(loadedTexture)
        }
      },
      undefined,
      (error) => {
        console.warn('Failed to load image texture:', url, error)
        if (!disposed) {
          setTexture(null)
        }
      },
    )

    return () => {
      disposed = true
      if (texture) {
        texture.dispose()
      }
    }
  }, [url])

  return texture
}

// Component for regular URL images (uses custom loader with error handling)
const RegularImage = ({ url, width, height }: ArtworkImageProps) => {
  const texture = useRegularTexture(url)
  const ambientColor = useAmbientLightColor('#ffffff', 1.0)

  if (!texture) {
    return <ImagePlaceholder width={width} height={height} />
  }

  applyCoverUVs(texture, width, height)

  return (
    <mesh castShadow receiveShadow renderOrder={2}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} color={ambientColor} side={DoubleSide} />
    </mesh>
  )
}

const ArtworkImage = ({ url, width, height }: ArtworkImageProps) => {
  // Skip rendering if URL is empty or invalid
  if (!url || url === '') {
    return <ImagePlaceholder width={width} height={height} />
  }

  // Use custom loader for blob URLs (temporary local previews)
  if (url.startsWith('blob:')) {
    return <BlobImage url={url} width={width} height={height} />
  }

  // Use custom loader for regular URLs (with error handling)
  return <RegularImage url={url} width={width} height={height} />
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
    frameSize,
    frameThickness,
    showPassepartout,
    passepartoutColor,
    passepartoutSize,
    passepartoutThickness,
    supportThickness,
    supportColor,
    showSupport,
    hideShadow,
  } = artwork

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)
  const dispatch = useDispatch()

  // Refs for click detection
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const pointerDownTime = useRef<number>(0)
  const singleClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Use the ambient light hook for frame and passepartout colors
  const frameAmbientColor = useAmbientLightColor(frameColor ?? '#000000')
  const passepartoutAmbientColor = useAmbientLightColor(passepartoutColor ?? '#ffffff')
  const supportAmbientColor = useAmbientLightColor(supportColor ?? '#ffffff')

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
      dispatch(
        setFocusTarget({
          artworkId: artwork.id,
          position: { x: position.x, y: position.y, z: position.z },
          normal: { x: normal.x, y: normal.y, z: normal.z },
          width: width || 1,
          height: height || 1,
        }),
      )

      // If the panel is already open, also update the current artwork info
      if (isArtworkPanelOpen) {
        dispatch(setCurrentArtwork(artwork.id))
      }
    }
  }, [
    dispatch,
    artwork.id,
    position,
    quaternion,
    width,
    height,
    isPlaceholdersShown,
    isArtworkPanelOpen,
    getNormalFromQuaternion,
  ])

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
  const handlePointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
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
    },
    [handleSingleClick],
  )

  const planeWidth = width || 1
  const planeHeight = height || 1

  // Frame material with ambient light applied - polished lacquered wood look
  const frameMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: frameAmbientColor,
      roughness: 0.15, // Low roughness for glossy/polished finish
      metalness: 0.2, // Slight metalness for subtle reflections
    })
  }, [frameAmbientColor])

  // Passepartout material with ambient light applied
  const passepartoutMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: passepartoutAmbientColor,
      roughness: 1,
    })
  }, [passepartoutAmbientColor])

  // Support material with ambient light applied
  const supportMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: supportAmbientColor,
      roughness: 1.0, // Fully rough like canvas or wood
    })
  }, [supportAmbientColor])

  const frameS = (showFrame ? frameSize?.value : 0) || 0
  // frameThickness is for Z-depth, range 1-20
  const frameDepth = Math.min(20, Math.max(1, frameThickness?.value ?? 1))
  const passepartoutS = (showPassepartout ? passepartoutSize?.value : 0) || 0
  // passepartoutThickness is for Z-depth, clamped 0.1-1.0
  const passepartoutDepth = Math.min(3, Math.max(0.2, passepartoutThickness?.value ?? 0.4))
  // supportThickness is for Z-depth, clamped 0-10
  const supportDepth = Math.min(10, Math.max(0, supportThickness?.value ?? 2))

  // Image stays at the artist-specified size (planeWidth × planeHeight).
  // Passepartout and frame grow OUTWARD around the image.
  const passepartoutBorder = passepartoutS / 100 // border width in 3D units
  const frameBorder = frameS / 100 // border width in 3D units

  // Passepartout outer = image + passepartout border on each side
  const passepartoutOuterW = planeWidth + passepartoutBorder * 2
  const passepartoutOuterH = planeHeight + passepartoutBorder * 2

  // Frame outer = passepartout outer + frame border on each side
  const frameOuterW = passepartoutOuterW + frameBorder * 2
  const frameOuterH = passepartoutOuterH + frameBorder * 2

  // The overall display size (for hit area and shadow)
  const totalWidth = frameOuterW
  const totalHeight = frameOuterH

  return (
    <group
      position={position}
      quaternion={quaternion}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <mesh renderOrder={1}>
        <planeGeometry args={[totalWidth, totalHeight]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Artwork sits on top of support surface — at the artist-specified size */}
      <group position={[0, 0, showSupport ? supportDepth / 100 : 0]}>
        {!imageUrl && (
          <mesh renderOrder={2}>
            <planeGeometry args={[planeWidth, planeHeight]} />
            <meshBasicMaterial color="white" side={DoubleSide} />
          </mesh>
        )}

        {imageUrl && <ArtworkImage url={imageUrl} width={planeWidth} height={planeHeight} />}
      </group>

      {/* Frame extends backward from Z=0 by frameDepth — outermost layer */}
      {showFrame && frameSize?.value && (
        <Frame
          width={frameOuterW}
          height={frameOuterH}
          thickness={frameBorder}
          depth={frameDepth / 100}
          material={frameMaterial}
        />
      )}

      {/* Passepartout sits ON TOP of support surface — between frame and image */}
      {showPassepartout && passepartoutSize?.value && (
        <group position={[0, 0, showSupport ? supportDepth / 100 : 0]}>
          <Passepartout
            width={passepartoutOuterW}
            height={passepartoutOuterH}
            thickness={passepartoutBorder}
            depth={passepartoutDepth / 100}
            material={passepartoutMaterial}
          />
        </group>
      )}

      {/* Shadow blur - memoized component, size proportional to frame depth */}
      {!hideShadow && (
        <ShadowDecal width={totalWidth} height={totalHeight} frameDepth={frameDepth / 100} />
      )}

      {/* Support (canvas/panel depth) - fits inside frame, front at Z=0 */}
      {showSupport && supportDepth > 0 && (
        <Support
          width={passepartoutOuterW}
          height={passepartoutOuterH}
          depth={supportDepth / 100}
          material={supportMaterial}
        />
      )}
    </group>
  )
}

export default Display
