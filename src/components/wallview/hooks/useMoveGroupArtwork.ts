import { useState, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { WALL_SCALE } from '@/components/wallview/constants'
import { convert2DTo3D } from '@/components/wallview/utils'
import { updateArtworkPosition, pushToHistory } from '@/redux/slices/exhibitionSlice'
import {
  editArtworkGroup,
  startDraggingGroup,
  stopDraggingGroup,
  setAlignedPairs,
} from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'
import type { TAlignmentPair } from '@/types/wallView'

export const useMoveGroupArtwork = (
  wallRef: RefObject<HTMLDivElement | null>,
  boundingData: TDimensions | null,
  scaleFactor: number,
  preventClick: React.RefObject<boolean>,
) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const artworkGroup = useSelector((state: RootState) => state.wallView.artworkGroup)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const snapEnabledById = useSelector((state: RootState) => state.wallView.snapEnabledById)

  const [isDraggingGroup, setIsDraggingGroup] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const handleGroupDragStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!wallRef.current || !artworkGroup) return

      const rect = wallRef.current.getBoundingClientRect()
      const offsetX = (event.clientX - rect.left) / scaleFactor - (artworkGroup.groupX ?? 0)
      const offsetY = (event.clientY - rect.top) / scaleFactor - (artworkGroup.groupY ?? 0)

      setOffset({ x: offsetX, y: offsetY })
      setIsDraggingGroup(true)
      dispatch(pushToHistory()) // Save state before group drag
      dispatch(startDraggingGroup())
      preventClick.current = true
    },
    [wallRef, scaleFactor, artworkGroup, dispatch, preventClick],
  )

  const handleGroupDragMove = useCallback(
    (event: MouseEvent) => {
      if (!isDraggingGroup || !wallRef.current || !boundingData || !artworkGroup) return

      const rect = wallRef.current.getBoundingClientRect()
      const scaledMouseX = (event.clientX - rect.left) / scaleFactor
      const scaledMouseY = (event.clientY - rect.top) / scaleFactor

      let x = scaledMouseX - offset.x
      let y = scaledMouseY - offset.y

      // Check wall center alignment for the group
      const wallWidth2d = boundingData.width * WALL_SCALE
      const wallHeight2d = boundingData.height * WALL_SCALE
      const tolerance = 3
      const alignedPairs: TAlignmentPair[] = []

      const groupWidth = artworkGroup.groupWidth ?? 0
      const groupHeight = artworkGroup.groupHeight ?? 0

      // Vertical center (group centered horizontally with wall)
      const groupCenterX = x + groupWidth / 2
      const wallCenterX = wallWidth2d / 2
      // Snap is enabled if any artwork in the group has it enabled
      const snapEnabled = artworkGroupIds.some((id) => snapEnabledById[id] ?? true)

      if (Math.abs(groupCenterX - wallCenterX) <= tolerance) {
        if (snapEnabled) {
          x = wallCenterX - groupWidth / 2
        }
        alignedPairs.push({
          from: '__group__',
          to: '__wall__',
          direction: 'center-vertical',
        })
      }

      // Horizontal center (group centered vertically with wall)
      const groupCenterY = y + groupHeight / 2
      const wallCenterY = wallHeight2d / 2
      if (Math.abs(groupCenterY - wallCenterY) <= tolerance) {
        if (snapEnabled) {
          y = wallCenterY - groupHeight / 2
        }
        alignedPairs.push({
          from: '__group__',
          to: '__wall__',
          direction: 'center-horizontal',
        })
      }

      dispatch(setAlignedPairs(alignedPairs))

      const deltaX = x - (artworkGroup.groupX ?? 0)
      const deltaY = y - (artworkGroup.groupY ?? 0)

      dispatch(editArtworkGroup({ groupX: x, groupY: y }))

      artworkGroupIds.forEach((artworkId) => {
        const artwork = exhibitionArtworksById[artworkId]
        if (!artwork) return

        const posX2d = artwork.posX2d + deltaX
        const posY2d = artwork.posY2d + deltaY
        const width2d = artwork.width2d
        const height2d = artwork.height2d

        const new3DCoordinate = convert2DTo3D(posX2d, posY2d, width2d, height2d, boundingData)

        dispatch(
          updateArtworkPosition({
            artworkId,
            artworkPosition: { posX2d, posY2d, width2d, height2d, ...new3DCoordinate },
          }),
        )
      })
    },
    [
      isDraggingGroup,
      wallRef,
      boundingData,
      scaleFactor,
      offset,
      artworkGroup,
      artworkGroupIds,
      exhibitionArtworksById,
      snapEnabledById,
      dispatch,
    ],
  )

  const handleGroupDragEnd = useCallback(() => {
    setIsDraggingGroup(false)
    dispatch(stopDraggingGroup())
    setTimeout(() => {
      preventClick.current = false
    }, 100)
  }, [dispatch, preventClick])

  useEffect(() => {
    if (isDraggingGroup) {
      const moveHandler = (event: MouseEvent) => handleGroupDragMove(event)
      const upHandler = () => handleGroupDragEnd()

      document.addEventListener('mousemove', moveHandler)
      document.addEventListener('mouseup', upHandler)

      return () => {
        document.removeEventListener('mousemove', moveHandler)
        document.removeEventListener('mouseup', upHandler)
      }
    }
  }, [isDraggingGroup, handleGroupDragMove, handleGroupDragEnd])

  return {
    handleGroupDragStart,
    handleGroupDragEnd,
  }
}
