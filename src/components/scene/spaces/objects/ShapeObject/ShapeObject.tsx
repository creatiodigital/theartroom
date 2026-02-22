'use client'

import { useRef, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { DoubleSide } from 'three'

import type { RootState } from '@/redux/store'
import { chooseCurrentArtworkId, addArtworkToGroup, removeGroup } from '@/redux/slices/wallViewSlice'
import { showWizard } from '@/redux/slices/wizardSlice'
import type { RuntimeArtwork } from '@/utils/artworkTransform'

type ShapeObjectProps = {
  artwork: RuntimeArtwork
}

// Constants for click detection
const CLICK_MAX_DISTANCE = 5
const CLICK_MAX_DURATION = 300

const ShapeObject = ({ artwork }: ShapeObjectProps) => {
  const dispatch = useDispatch()

  const {
    id,
    width,
    height,
    position,
    quaternion,
    shapeType,
    shapeColor,
    shapeOpacity,
  } = artwork

  const isEditMode = useSelector((state: RootState) => state.dashboard.isEditMode)
  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null)

  const handlePointerDown = useCallback((e: { stopPropagation: () => void; clientX: number; clientY: number }) => {
    if (!isEditMode) return
    e.stopPropagation()
    pointerDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }
  }, [isEditMode])

  const handlePointerUp = useCallback((e: { stopPropagation: () => void; clientX: number; clientY: number }) => {
    if (!isEditMode || !pointerDownRef.current) return
    e.stopPropagation()

    const dx = e.clientX - pointerDownRef.current.x
    const dy = e.clientY - pointerDownRef.current.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const duration = Date.now() - pointerDownRef.current.time
    pointerDownRef.current = null

    if (dist < CLICK_MAX_DISTANCE && duration < CLICK_MAX_DURATION) {
      dispatch(chooseCurrentArtworkId(id))
      dispatch(removeGroup())
      dispatch(addArtworkToGroup(id))
      dispatch(showWizard())
    }
  }, [isEditMode, id, dispatch])

  const color = shapeColor ?? '#000000'
  const opacity = shapeOpacity ?? 1
  const type = shapeType ?? 'rectangle'

  // Read rotation from exhibition position
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const rotationDeg = exhibitionArtworksById[id]?.rotation ?? 0
  const rotationRad = (rotationDeg * Math.PI) / 180

  return (
    <group position={position} quaternion={quaternion}>
      <mesh
        rotation={[0, 0, rotationRad]}
        scale={type === 'circle' ? [width, height, 1] : undefined}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {type === 'circle' ? (
          <circleGeometry args={[0.5, 64]} />
        ) : (
          <planeGeometry args={[width, height]} />
        )}
        <meshBasicMaterial
          color={color}
          side={DoubleSide}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
    </group>
  )
}

export default ShapeObject
