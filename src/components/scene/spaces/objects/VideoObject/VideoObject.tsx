import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  DoubleSide,
  MeshStandardMaterial,
  Vector3,
  Quaternion,
} from 'three'
import { useFrame } from '@react-three/fiber'
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

type VideoObjectProps = {
  artwork: RuntimeArtwork
}

// Constants for click detection
const CLICK_MAX_DISTANCE = 5
const CLICK_MAX_DURATION = 300
const DOUBLE_CLICK_DELAY = 250

const VideoObject = ({ artwork }: VideoObjectProps) => {
  const {
    position,
    quaternion,
    width,
    height,
    videoUrl,
    videoPlayMode,
    videoProximityDistance,
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
    frameCornerStyle,
  } = artwork

  const playMode = videoPlayMode ?? 'proximity'

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)
  const shadowBlur = useSelector((state: RootState) => state.exhibition.shadowBlur ?? 0.025)
  const shadowSpread = useSelector((state: RootState) => state.exhibition.shadowSpread ?? 1.2)
  const shadowOpacity = useSelector((state: RootState) => state.exhibition.shadowOpacity ?? 0.25)
  const shadowDirection = useSelector((state: RootState) => state.exhibition.shadowDirection ?? 0.2)
  const dispatch = useDispatch()

  // Refs for click detection
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const pointerDownTime = useRef<number>(0)
  const singleClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Video element — created once, starts paused at frame 0 ──
  const [video] = useState(() => {
    if (!videoUrl) return null
    const vid = document.createElement('video')
    vid.src = videoUrl
    vid.crossOrigin = 'Anonymous'
    vid.loop = true
    vid.muted = true
    vid.playsInline = true
    vid.preload = 'auto'
    vid.load() // Force browser to start buffering
    return vid
  })

  // Play state
  const isPlayingRef = useRef(false)
  // Minimum 4m, default 5m
  const proximityDistance = Math.max(4, videoProximityDistance ?? 5)

  // 'always' mode: auto-play on mount
  useEffect(() => {
    if (!video || playMode !== 'always') return
    video.muted = false
    video.play().catch(() => {})
    isPlayingRef.current = true
    return () => {
      video.pause()
      video.muted = true
      isPlayingRef.current = false
    }
  }, [video, playMode])

  // Clean up video element on unmount — only pause, don't destroy src
  useEffect(() => {
    return () => {
      if (video) {
        video.pause()
      }
    }
  }, [video])

  // Ambient light colors
  const frameAmbientColor = useAmbientLightColor(frameColor ?? '#000000')
  const passepartoutAmbientColor = useAmbientLightColor(passepartoutColor ?? '#ffffff')
  const supportAmbientColor = useAmbientLightColor(supportColor ?? '#ffffff')

  // ── Proximity mode: play on enter, pause on exit ──
  useFrame(({ camera }) => {
    if (playMode !== 'proximity') return
    if (!position || !video || !videoUrl) return

    const artworkPos = new Vector3(position.x, position.y, position.z)
    const distance = camera.position.distanceTo(artworkPos)

    if (distance <= proximityDistance && !isPlayingRef.current) {
      isPlayingRef.current = true
      // Defensive: restore src if cleared by HMR
      if (!video.src || video.readyState === 0) {
        video.src = videoUrl
        video.load()
      }
      video.muted = false
      video.play().catch(() => {})
    } else if (distance > proximityDistance && isPlayingRef.current) {
      isPlayingRef.current = false
      video.muted = true
      video.pause()
    }
  })

  // Calculate the normal vector from artwork's quaternion
  const getNormalFromQuaternion = useCallback((q: Quaternion): Vector3 => {
    const normal = new Vector3(0, 0, 1)
    normal.applyQuaternion(q)
    return normal
  }, [])

  // Handle single click — in 'click' mode toggles video, otherwise focuses camera
  const handleSingleClick = useCallback(() => {
    // Click-to-play mode: toggle video
    if (playMode === 'click' && video) {
      if (isPlayingRef.current) {
        isPlayingRef.current = false
        video.muted = true
        video.pause()
      } else {
        isPlayingRef.current = true
        if (!video.src || video.readyState === 0) {
          video.src = videoUrl!
          video.load()
        }
        video.muted = false
        video.play().catch(() => {})
      }
      return
    }

    // Default: focus camera on artwork
    if (!isPlaceholdersShown && quaternion && position) {
      const normal = getNormalFromQuaternion(quaternion)

      const pBorder = (showPassepartout ? passepartoutSize?.value : 0) || 0
      const fBorder = (showFrame ? frameSize?.value : 0) || 0
      const displayWidth = (width || 1) + (pBorder * 2 + fBorder * 2) / 100
      const displayHeight = (height || 1) + (pBorder * 2 + fBorder * 2) / 100

      dispatch(
        setFocusTarget({
          artworkId: artwork.id,
          position: { x: position.x, y: position.y, z: position.z },
          normal: { x: normal.x, y: normal.y, z: normal.z },
          width: displayWidth,
          height: displayHeight,
        }),
      )

      if (isArtworkPanelOpen) {
        dispatch(setCurrentArtwork(artwork.id))
      }
    }
  }, [
    playMode,
    video,
    videoUrl,
    dispatch,
    artwork.id,
    position,
    quaternion,
    width,
    height,
    isPlaceholdersShown,
    isArtworkPanelOpen,
    getNormalFromQuaternion,
    showPassepartout,
    passepartoutSize,
    showFrame,
    frameSize,
  ])

  // Handle double click to open artwork panel
  const handleDoubleClick = useCallback(() => {
    dispatch(setCurrentArtwork(artwork.id))
    dispatch(showArtworkPanel())
  }, [dispatch, artwork.id])

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    pointerDownPos.current = { x: e.clientX, y: e.clientY }
    pointerDownTime.current = Date.now()
  }, [])

  const handlePointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()

      if (!pointerDownPos.current) return
      const dx = e.clientX - pointerDownPos.current.x
      const dy = e.clientY - pointerDownPos.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const duration = Date.now() - pointerDownTime.current
      pointerDownPos.current = null

      if (distance > CLICK_MAX_DISTANCE || duration > CLICK_MAX_DURATION) return

      if (singleClickTimeout.current) {
        clearTimeout(singleClickTimeout.current)
        singleClickTimeout.current = null
        handleDoubleClick()
      } else {
        singleClickTimeout.current = setTimeout(() => {
          singleClickTimeout.current = null
          handleSingleClick()
        }, DOUBLE_CLICK_DELAY)
      }
    },
    [handleSingleClick, handleDoubleClick],
  )

  // Computed dimensions
  const planeWidth = width || 1
  const planeHeight = height || 1

  const frameS = (showFrame ? frameSize?.value : 0) || 0
  const frameDepth = Math.min(20, Math.max(1, frameThickness?.value ?? 1))
  const passepartoutS = (showPassepartout ? passepartoutSize?.value : 0) || 0
  const passepartoutDepth = Math.min(3, Math.max(0.2, passepartoutThickness?.value ?? 0.4))
  const supportDepth = Math.min(10, Math.max(0, supportThickness?.value ?? 2))

  const passepartoutBorder = passepartoutS / 100
  const frameBorder = frameS / 100

  const passepartoutOuterW = planeWidth + passepartoutBorder * 2
  const passepartoutOuterH = planeHeight + passepartoutBorder * 2
  const frameOuterW = passepartoutOuterW + frameBorder * 2
  const frameOuterH = passepartoutOuterH + frameBorder * 2
  const totalWidth = frameOuterW
  const totalHeight = frameOuterH

  // Materials
  const frameMatObj = useMemo(() => {
    return new MeshStandardMaterial({
      color: frameAmbientColor,
      roughness: 0.6,
      metalness: 0.05,
    })
  }, [frameAmbientColor])

  const passepartoutMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: passepartoutAmbientColor,
      roughness: 1,
    })
  }, [passepartoutAmbientColor])

  const supportMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: supportAmbientColor,
      roughness: 1.0,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    })
  }, [supportAmbientColor])

  return (
    <group
      position={position}
      quaternion={quaternion}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Invisible hit area covering the full frame */}
      <mesh renderOrder={1}>
        <planeGeometry args={[totalWidth, totalHeight]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Artwork plane — video as self-lit screen */}
      <group position={[0, 0, showSupport ? supportDepth / 100 : 0]}>
        {video ? (
          <mesh castShadow receiveShadow renderOrder={2}>
            <planeGeometry args={[planeWidth, planeHeight]} />
            <meshStandardMaterial color="black" emissive="white" emissiveIntensity={0.6} toneMapped={false} side={DoubleSide}>
              <videoTexture attach="emissiveMap" args={[video]} />
            </meshStandardMaterial>
          </mesh>
        ) : (
          <mesh renderOrder={2}>
            <planeGeometry args={[planeWidth, planeHeight]} />
            <meshBasicMaterial color="white" side={DoubleSide} />
          </mesh>
        )}
      </group>

      {/* Frame */}
      {showFrame && frameSize?.value && (
        <Frame
          width={frameOuterW}
          height={frameOuterH}
          thickness={frameBorder}
          depth={frameDepth / 100}
          material={frameMatObj}
          cornerStyle={(frameCornerStyle as 'mitered' | 'straight') ?? 'mitered'}
        />
      )}

      {/* Passepartout */}
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

      {/* Shadow */}
      {!hideShadow && (
        <ShadowDecal
          width={totalWidth}
          height={totalHeight}
          frameDepth={showFrame ? frameDepth / 100 : showSupport ? supportDepth / 100 : 0}
          blur={shadowBlur}
          spread={shadowSpread}
          opacity={shadowOpacity}
          direction={shadowDirection}
        />
      )}

      {/* Support */}
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

export default VideoObject
