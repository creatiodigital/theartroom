import { useState, useMemo, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { updateArtworkPosition, pushToHistory } from '@/redux/slices/exhibitionSlice'
import {
  setAlignedPairs,
  startDragging,
  stopDragging,
  chooseCurrentArtworkId,
} from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'
import type { TAlignmentPair } from '@/types/wallView'

import { areAligned } from './helpers'

type TOffset = { x: number; y: number }

export const useMoveArtwork = (
  wallRef: RefObject<HTMLDivElement>,
  boundingData: TDimensions | null,
  scaleFactor: number,
) => {
  const [draggedArtworkId, setDraggedArtworkId] = useState<string | null>(null)
  const [offset, setOffset] = useState<TOffset>({ x: 0, y: 0 })

  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const allExhibitionArtworkIds = useSelector(
    (state: RootState) => state.exhibition.allExhibitionArtworkIds,
  )
  const isEditingArtwork = useSelector((state: RootState) => state.dashboard.isEditingArtwork)
  const isDragging = useSelector((state: RootState) => state.wallView.isDragging)
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const dispatch = useDispatch()

  const isArtworkVisible = artworkGroupIds.length > 1

  const handleArtworkDragStart = useCallback(
    (event: MouseEvent, artworkId: string) => {
      if (isEditingArtwork || !wallRef.current || isArtworkVisible) return

      event.stopPropagation()

      const rect = wallRef.current.getBoundingClientRect()
      const artwork = exhibitionArtworksById[artworkId]
      if (!artwork) return

      const offsetX = (event.clientX - rect.left) / scaleFactor - artwork.posX2d
      const offsetY = (event.clientY - rect.top) / scaleFactor - artwork.posY2d
      setOffset({ x: offsetX, y: offsetY })

      // Save current state to history before starting drag
      dispatch(pushToHistory())
      dispatch(startDragging())
      setDraggedArtworkId(artworkId)
      dispatch(chooseCurrentArtworkId(artworkId))
    },
    [isEditingArtwork, wallRef, isArtworkVisible, exhibitionArtworksById, scaleFactor, dispatch],
  )

  const handleArtworkDragMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging || !draggedArtworkId || !boundingData || !wallRef.current) return

      event.preventDefault()
      event.stopPropagation()

      const rect = wallRef.current.getBoundingClientRect()
      const scaledMouseX = (event.clientX - rect.left) / scaleFactor
      const scaledMouseY = (event.clientY - rect.top) / scaleFactor

      let x = scaledMouseX - offset.x
      let y = scaledMouseY - offset.y

      const artwork = exhibitionArtworksById[draggedArtworkId]
      if (!artwork) return

      const sameWallArtworks = allExhibitionArtworkIds
        .filter(
          (id) => id !== draggedArtworkId && exhibitionArtworksById[id].wallId === currentWallId,
        )
        .map((id) => exhibitionArtworksById[id])

      let snapX = x
      let snapY = y

      const alignedPairs: TAlignmentPair[] = []

      sameWallArtworks.forEach((otherArtwork) => {
        const alignment = areAligned(
          { x: snapX, y: snapY, width: artwork.width2d, height: artwork.height2d },
          {
            x: otherArtwork.posX2d,
            y: otherArtwork.posY2d,
            width: otherArtwork.width2d,
            height: otherArtwork.height2d,
          },
        )

        // Handle horizontal alignments (can be multiple)
        if (alignment.horizontal.length > 0) {
          // Use first alignment for snapping
          const firstH = alignment.horizontal[0]
          if (firstH === 'top') {
            snapY = otherArtwork.posY2d
          } else if (firstH === 'bottom') {
            snapY = otherArtwork.posY2d + otherArtwork.height2d - artwork.height2d
          } else if (firstH === 'center-horizontal') {
            snapY = otherArtwork.posY2d + otherArtwork.height2d / 2 - artwork.height2d / 2
          }

          // Add all matching alignments to pairs
          if (draggedArtworkId && otherArtwork?.artworkId) {
            alignment.horizontal.forEach((dir) => {
              alignedPairs.push({
                from: draggedArtworkId,
                to: otherArtwork.artworkId,
                direction: dir,
              })
            })
          }
        }

        // Handle vertical alignments (can be multiple)
        if (alignment.vertical.length > 0) {
          // Use first alignment for snapping
          const firstV = alignment.vertical[0]
          if (firstV === 'left') {
            snapX = otherArtwork.posX2d
          } else if (firstV === 'right') {
            snapX = otherArtwork.posX2d + otherArtwork.width2d - artwork.width2d
          } else if (firstV === 'center-vertical') {
            snapX = otherArtwork.posX2d + otherArtwork.width2d / 2 - artwork.width2d / 2
          }

          // Add all matching alignments to pairs
          if (draggedArtworkId && otherArtwork?.artworkId) {
            alignment.vertical.forEach((dir) => {
              alignedPairs.push({
                from: draggedArtworkId,
                to: otherArtwork.artworkId,
                direction: dir,
              })
            })
          }
        }
      })

      // Check wall center alignment
      const wallWidth2d = boundingData.width * 100 // scaling factor
      const wallHeight2d = boundingData.height * 100
      const tolerance = 3

      // Vertical center of wall (artwork centered horizontally)
      const artworkCenterX = snapX + artwork.width2d / 2
      const wallCenterX = wallWidth2d / 2
      if (Math.abs(artworkCenterX - wallCenterX) <= tolerance) {
        snapX = wallCenterX - artwork.width2d / 2
        alignedPairs.push({
          from: draggedArtworkId,
          to: '__wall__',
          direction: 'center-vertical',
        })
      }

      // Horizontal center of wall (artwork centered vertically)
      const artworkCenterY = snapY + artwork.height2d / 2
      const wallCenterY = wallHeight2d / 2
      if (Math.abs(artworkCenterY - wallCenterY) <= tolerance) {
        snapY = wallCenterY - artwork.height2d / 2
        alignedPairs.push({
          from: draggedArtworkId,
          to: '__wall__',
          direction: 'center-horizontal',
        })
      }

      dispatch(setAlignedPairs(alignedPairs))

      const artworkPosition = {
        posX2d: snapX,
        posY2d: snapY,
      }

      const new3DCoordinate = convert2DTo3D(
        snapX,
        snapY,
        artwork.width2d,
        artwork.height2d,
        boundingData,
      )

      dispatch(
        updateArtworkPosition({
          artworkId: draggedArtworkId,
          artworkPosition: { ...artworkPosition, ...new3DCoordinate },
        }),
      )
    },
    [
      isDragging,
      draggedArtworkId,
      wallRef,
      boundingData,
      scaleFactor,
      offset,
      currentWallId,
      allExhibitionArtworkIds,
      exhibitionArtworksById,
      dispatch,
    ],
  )

  const handleArtworkDragEnd = useCallback(() => {
    dispatch(stopDragging())
    setDraggedArtworkId(null)
  }, [dispatch])

  useEffect(() => {
    if (isDragging) {
      const moveHandler = (event: MouseEvent) => handleArtworkDragMove(event)
      const upHandler = () => handleArtworkDragEnd()

      document.addEventListener('mousemove', moveHandler)
      document.addEventListener('mouseup', upHandler)

      return () => {
        document.removeEventListener('mousemove', moveHandler)
        document.removeEventListener('mouseup', upHandler)
      }
    }
  }, [isDragging, handleArtworkDragMove, handleArtworkDragEnd])

  return useMemo(
    () => ({
      draggedArtworkId,
      handleArtworkDragStart,
      handleArtworkDragMove,
      handleArtworkDragEnd,
    }),
    [draggedArtworkId, handleArtworkDragStart, handleArtworkDragMove, handleArtworkDragEnd],
  )
}
