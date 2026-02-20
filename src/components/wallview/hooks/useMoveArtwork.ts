import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { WALL_SCALE } from '@/components/wallview/constants'
import { convert2DTo3D, getVisualBounds } from '@/components/wallview/utils'
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

const DRAG_DELAY_MS = 150 // Milliseconds to hold before showing distance lines

export const useMoveArtwork = (
  wallRef: RefObject<HTMLDivElement>,
  boundingData: TDimensions | null,
  scaleFactor: number,
) => {
  const [draggedArtworkId, setDraggedArtworkId] = useState<string | null>(null)
  const [offset, setOffset] = useState<TOffset>({ x: 0, y: 0 })
  const dragDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasDragStarted = useRef(false)

  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const allExhibitionArtworkIds = useSelector(
    (state: RootState) => state.exhibition.allExhibitionArtworkIds,
  )
  const isEditingArtwork = useSelector((state: RootState) => state.dashboard.isEditingArtwork)
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const snapEnabledById = useSelector((state: RootState) => state.wallView.snapEnabledById)
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const dispatch = useDispatch()

  const isArtworkVisible = artworkGroupIds.length > 1

  const handleArtworkDragStart = useCallback(
    (event: MouseEvent, artworkId: string) => {
      if (isEditingArtwork || !wallRef.current || isArtworkVisible) return

      // When Shift is held, skip drag start so onClick can handle group selection
      if (event.shiftKey) return

      event.stopPropagation()

      const rect = wallRef.current.getBoundingClientRect()
      const artwork = exhibitionArtworksById[artworkId]
      if (!artwork) return

      const offsetX = (event.clientX - rect.left) / scaleFactor - artwork.posX2d
      const offsetY = (event.clientY - rect.top) / scaleFactor - artwork.posY2d
      setOffset({ x: offsetX, y: offsetY })

      hasDragStarted.current = false

      // Save current state to history before starting drag
      dispatch(pushToHistory())
      setDraggedArtworkId(artworkId)
      dispatch(chooseCurrentArtworkId(artworkId))

      // Start timer - dispatch startDragging after delay
      dragDelayTimer.current = setTimeout(() => {
        hasDragStarted.current = true
        dispatch(startDragging())
      }, DRAG_DELAY_MS)
    },
    [isEditingArtwork, wallRef, isArtworkVisible, exhibitionArtworksById, scaleFactor, dispatch],
  )

  const handleArtworkDragMove = useCallback(
    (event: MouseEvent) => {
      // Check if we have an artwork to drag (mousedown happened)
      if (!draggedArtworkId || !boundingData || !wallRef.current) return

      event.preventDefault()
      event.stopPropagation()

      // Always move the artwork (even before timer fires for distance lines)
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

      // Compute visual bounds (including frame/passepartout) for alignment
      const draggedVisual = getVisualBounds(artwork, artworksById[artwork.artworkId])
      // Visual offset: how much the visual edge extends beyond the image position
      const draggedOffsetX = artwork.posX2d - draggedVisual.x
      const draggedOffsetY = artwork.posY2d - draggedVisual.y

      let snapX = x
      let snapY = y

      const alignedPairs: TAlignmentPair[] = []

      sameWallArtworks.forEach((otherArtwork) => {
        const otherVisual = getVisualBounds(otherArtwork, artworksById[otherArtwork.artworkId])
        const alignment = areAligned(
          {
            x: snapX - draggedOffsetX,
            y: snapY - draggedOffsetY,
            width: draggedVisual.width,
            height: draggedVisual.height,
          },
          {
            x: otherVisual.x,
            y: otherVisual.y,
            width: otherVisual.width,
            height: otherVisual.height,
          },
        )

        // Handle horizontal alignments (can be multiple)
        if (alignment.horizontal.length > 0) {
          // Use first alignment for snapping (only if snap enabled)
          const snapEnabled = draggedArtworkId ? (snapEnabledById[draggedArtworkId] ?? true) : true
          if (snapEnabled) {
            const firstH = alignment.horizontal[0]
            if (firstH === 'top') {
              snapY = otherVisual.y + draggedOffsetY
            } else if (firstH === 'bottom') {
              snapY = otherVisual.y + otherVisual.height - draggedVisual.height + draggedOffsetY
            } else if (firstH === 'center-horizontal') {
              snapY =
                otherVisual.y + otherVisual.height / 2 - draggedVisual.height / 2 + draggedOffsetY
            }
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
          // Use first alignment for snapping (only if snap enabled)
          const snapEnabled = draggedArtworkId ? (snapEnabledById[draggedArtworkId] ?? true) : true
          if (snapEnabled) {
            const firstV = alignment.vertical[0]
            if (firstV === 'left') {
              snapX = otherVisual.x + draggedOffsetX
            } else if (firstV === 'right') {
              snapX = otherVisual.x + otherVisual.width - draggedVisual.width + draggedOffsetX
            } else if (firstV === 'center-vertical') {
              snapX =
                otherVisual.x + otherVisual.width / 2 - draggedVisual.width / 2 + draggedOffsetX
            }
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
      const wallWidth2d = boundingData.width * WALL_SCALE
      const wallHeight2d = boundingData.height * WALL_SCALE
      const tolerance = 8
      const snapEnabled = draggedArtworkId ? (snapEnabledById[draggedArtworkId] ?? true) : true

      // Vertical center of wall (artwork visual center aligned with wall center)
      const artworkVisualCenterX = snapX - draggedOffsetX + draggedVisual.width / 2
      const wallCenterX = wallWidth2d / 2
      if (Math.abs(artworkVisualCenterX - wallCenterX) <= tolerance) {
        if (snapEnabled) {
          snapX = wallCenterX - draggedVisual.width / 2 + draggedOffsetX
        }
        alignedPairs.push({
          from: draggedArtworkId,
          to: '__wall__',
          direction: 'center-vertical',
        })
      }

      // Horizontal center of wall (artwork visual center aligned with wall center)
      const artworkVisualCenterY = snapY - draggedOffsetY + draggedVisual.height / 2
      const wallCenterY = wallHeight2d / 2
      if (Math.abs(artworkVisualCenterY - wallCenterY) <= tolerance) {
        if (snapEnabled) {
          snapY = wallCenterY - draggedVisual.height / 2 + draggedOffsetY
        }
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
      draggedArtworkId,
      wallRef,
      boundingData,
      scaleFactor,
      offset,
      currentWallId,
      allExhibitionArtworkIds,
      exhibitionArtworksById,
      artworksById,
      snapEnabledById,
      dispatch,
    ],
  )

  const handleArtworkDragEnd = useCallback(() => {
    // Clear the timer if it's still pending
    if (dragDelayTimer.current) {
      clearTimeout(dragDelayTimer.current)
      dragDelayTimer.current = null
    }
    if (hasDragStarted.current) {
      dispatch(stopDragging())
    }
    setDraggedArtworkId(null)
    hasDragStarted.current = false
  }, [dispatch])

  useEffect(() => {
    if (draggedArtworkId) {
      const moveHandler = (event: MouseEvent) => handleArtworkDragMove(event)
      const upHandler = () => handleArtworkDragEnd()

      document.addEventListener('mousemove', moveHandler)
      document.addEventListener('mouseup', upHandler)

      return () => {
        document.removeEventListener('mousemove', moveHandler)
        document.removeEventListener('mouseup', upHandler)
      }
    }
  }, [draggedArtworkId, handleArtworkDragMove, handleArtworkDragEnd])

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
