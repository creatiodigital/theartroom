'use client'

import { useRef, useCallback, useEffect } from 'react'
import { DoubleSide, Vector3, Quaternion } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { PositionalAudio } from '@react-three/drei'
import type { PositionalAudio as PositionalAudioImpl } from 'three'
import { useDispatch, useSelector } from 'react-redux'

import { useSceneAudio } from '@/contexts/SceneAudioContext'
import { setFocusTarget, setCurrentArtwork } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { RuntimeArtwork } from '@/utils/artworkTransform'
import { useIconTexture } from './useIconTexture'

type SoundObjectProps = {
  artwork: RuntimeArtwork
}

// Constants for click detection
const CLICK_MAX_DISTANCE = 5
const CLICK_MAX_DURATION = 300
const DOUBLE_CLICK_DELAY = 250

const SoundObject = ({ artwork }: SoundObjectProps) => {
  const {
    id,
    position,
    quaternion,
    width,
    height,
    soundIcon = 'volume-2',
    soundBackgroundColor,
    soundIconColor = '#000000',
    soundIconSize = 24,
    soundUrl,
    soundPlayMode = 'play-once',
    soundSpatial = true,
    soundDistance = 5,
  } = artwork

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)
  const autofocusGroups = useSelector((state: RootState) => state.exhibition.autofocusGroups ?? [])
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const dispatch = useDispatch()
  const { playingId, play, stop } = useSceneAudio()

  const audioRef = useRef<PositionalAudioImpl>(null)
  const isPlaying = playingId === id

  // Refs for click detection
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const pointerDownTime = useRef<number>(0)
  const singleClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const planeWidth = width || 0.4
  const planeHeight = height || 0.4

  // Bake icon into a canvas texture — icon size fraction maps from 2D px size
  const iconFraction = Math.min((soundIconSize / 100) * 3.6, 0.85)
  const displayColor = isPlaying ? '#e53e3e' : soundIconColor
  const texture = useIconTexture(
    soundIcon,
    displayColor,
    soundBackgroundColor ?? undefined,
    iconFraction,
  )

  // Reference distance: spatial → user-defined, omnipresent → very large
  const refDistance = soundSpatial ? soundDistance : 10000

  // Sync ref distance when props change while audio exists
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.setRefDistance(refDistance)
    }
  }, [refDistance])

  // Handle ended event to reset playing state (for play-once mode)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || soundPlayMode === 'loop') return

    audio.onEnded = () => stop()

    return () => {
      if (audio.onEnded) audio.onEnded = () => {}
    }
  }, [soundUrl, soundPlayMode, stop])

  // Stop audio when this SoundObject unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current?.isPlaying) {
        stop()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Calculate the normal vector from artwork's quaternion
  const getNormalFromQuaternion = useCallback((q: Quaternion): Vector3 => {
    const normal = new Vector3(0, 0, 1)
    normal.applyQuaternion(q)
    return normal
  }, [])

  // Handle single click for focus
  const handleSingleClick = useCallback(() => {
    if (!isPlaceholdersShown && quaternion && position) {
      const normal = getNormalFromQuaternion(quaternion)

      // Check if this artwork belongs to an autofocus group
      const group = autofocusGroups.find((g) => g.artworkIds.includes(id))

      if (group && group.artworkIds.length >= 2) {
        // Compute group center from all member 3D positions
        let minX = Infinity,
          maxX = -Infinity
        let minY = Infinity,
          maxY = -Infinity
        let minZ = Infinity,
          maxZ = -Infinity

        for (const memberId of group.artworkIds) {
          const pos = exhibitionArtworksById[memberId]
          if (!pos) continue
          let halfW = (pos.width3d ?? pos.width2d / 100) / 2
          let halfH = (pos.height3d ?? pos.height2d / 100) / 2

          // Add frame + passepartout borders (cm → meters)
          const memberArt = artworksById[memberId]
          if (memberArt?.showFrame && memberArt?.imageUrl && memberArt?.frameSize?.value) {
            halfW += memberArt.frameSize.value / 100
            halfH += memberArt.frameSize.value / 100
          }
          if (memberArt?.showPassepartout && memberArt?.imageUrl && memberArt?.passepartoutSize?.value) {
            halfW += memberArt.passepartoutSize.value / 100
            halfH += memberArt.passepartoutSize.value / 100
          }

          minX = Math.min(minX, pos.posX3d - halfW)
          maxX = Math.max(maxX, pos.posX3d + halfW)
          minY = Math.min(minY, pos.posY3d - halfH)
          maxY = Math.max(maxY, pos.posY3d + halfH)
          minZ = Math.min(minZ, pos.posZ3d - halfW)
          maxZ = Math.max(maxZ, pos.posZ3d + halfW)
        }

        const centerX = (minX + maxX) / 2
        const centerY = (minY + maxY) / 2
        const centerZ = (minZ + maxZ) / 2
        const groupWidth = Math.max(maxX - minX, maxZ - minZ)
        const groupHeight = maxY - minY

        dispatch(
          setFocusTarget({
            artworkId: id,
            position: { x: centerX, y: centerY, z: centerZ },
            normal: { x: normal.x, y: normal.y, z: normal.z },
            width: Math.max(groupWidth, 0.1),
            height: Math.max(groupHeight, 0.1),
          }),
        )
      } else {
        // Individual artwork focus (default behavior)
        dispatch(
          setFocusTarget({
            artworkId: id,
            position: { x: position.x, y: position.y, z: position.z },
            normal: { x: normal.x, y: normal.y, z: normal.z },
            width: planeWidth,
            height: planeHeight,
          }),
        )
      }

      if (isArtworkPanelOpen) {
        dispatch(setCurrentArtwork(id))
      }
    }
  }, [
    dispatch,
    id,
    position,
    quaternion,
    planeWidth,
    planeHeight,
    isPlaceholdersShown,
    isArtworkPanelOpen,
    getNormalFromQuaternion,
    autofocusGroups,
    exhibitionArtworksById,
    artworksById,
  ])

  // Handle double click - play/stop sound
  const handleDoubleClick = useCallback(() => {
    if (singleClickTimeout.current) {
      clearTimeout(singleClickTimeout.current)
      singleClickTimeout.current = null
    }

    if (!soundUrl || isPlaceholdersShown || !audioRef.current) return

    if (isPlaying) {
      stop()
    } else {
      play(id, audioRef.current)
    }
  }, [soundUrl, isPlaying, isPlaceholdersShown, id, play, stop])

  // Pointer down
  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (singleClickTimeout.current) {
      clearTimeout(singleClickTimeout.current)
      singleClickTimeout.current = null
    }
    pointerDownPos.current = { x: event.clientX, y: event.clientY }
    pointerDownTime.current = Date.now()
  }, [])

  // Pointer up
  const handlePointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!pointerDownPos.current) return

      const dx = event.clientX - pointerDownPos.current.x
      const dy = event.clientY - pointerDownPos.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const duration = Date.now() - pointerDownTime.current

      pointerDownPos.current = null

      if (distance < CLICK_MAX_DISTANCE && duration < CLICK_MAX_DURATION) {
        singleClickTimeout.current = setTimeout(() => {
          handleSingleClick()
          singleClickTimeout.current = null
        }, DOUBLE_CLICK_DELAY)
      }
    },
    [handleSingleClick],
  )

  return (
    <group
      position={position}
      quaternion={quaternion}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Single plane with icon baked into texture */}
      <mesh renderOrder={1}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial
          map={texture}
          side={DoubleSide}
          transparent={!soundBackgroundColor}
          depthWrite={!!soundBackgroundColor}
        />
      </mesh>

      {/* Positional audio — only rendered when a sound file is attached */}
      {soundUrl && (
        <PositionalAudio
          ref={audioRef}
          url={soundUrl}
          distance={refDistance}
          loop={soundPlayMode === 'loop'}
          autoplay={false}
        />
      )}
    </group>
  )
}

export default SoundObject
