import { useCallback, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { updateArtworkPosition, pushToHistory } from '@/redux/slices/exhibitionSlice'
import {
  setAlignedPairs,
  clearAlignedPairs,
  startResizing,
  stopResizing,
} from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'
import type { TDirection, TAlignmentPair } from '@/types/wallView'

const SNAP_TOLERANCE = 3

export const useResizeArtwork = (
  boundingData: TDimensions | null,
  scaleFactor: number,
  wallRef: RefObject<HTMLDivElement | null>,
) => {
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const allExhibitionArtworkIds = useSelector(
    (state: RootState) => state.exhibition.allExhibitionArtworkIds,
  )
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)

  const dispatch = useDispatch()
  const isGridVisible = useSelector((state: RootState) => state.wallView.isGridVisible)
  const sizeLocked = useSelector((state: RootState) => state.wallView.sizeLocked)
  const gridSize = 20

  // Track if we're currently resizing
  const isResizingRef = useRef(false)

  const handleResize = useCallback(
    (event: React.MouseEvent, artworkId: string, direction: TDirection) => {
      event.stopPropagation()

      const artwork = exhibitionArtworksById[artworkId]

      if (!artwork || !wallRef.current) return

      const rect = wallRef.current.getBoundingClientRect()

      const gridOffsetX = (rect.width % gridSize) / 2
      const gridOffsetY = (rect.height % gridSize) / 2

      const startX = event.clientX
      const startY = event.clientY
      const initialWidth = artwork.width2d
      const initialHeight = artwork.height2d
      const initialX = artwork.posX2d
      const initialY = artwork.posY2d

      // Get other artworks on the same wall for snapping
      const sameWallArtworks = allExhibitionArtworkIds
        .filter((id) => id !== artworkId && exhibitionArtworksById[id].wallId === currentWallId)
        .map((id) => exhibitionArtworksById[id])

      // Start resizing state
      dispatch(pushToHistory()) // Save current state before resize
      dispatch(startResizing())
      isResizingRef.current = true

      // Calculate aspect ratio for proportional resize
      const aspectRatio = initialWidth / initialHeight

      // Check if this is a corner resize (has both horizontal and vertical components)
      const isCornerResize =
        (direction.includes('left') || direction.includes('right')) &&
        (direction.includes('top') || direction.includes('bottom'))

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = (moveEvent.clientX - startX) / scaleFactor
        const deltaY = (moveEvent.clientY - startY) / scaleFactor

        let newWidth = initialWidth
        let newHeight = initialHeight
        let newX = initialX
        let newY = initialY

        const alignedPairs: TAlignmentPair[] = []

        // Proportional resize with Shift key OR sizeLocked checkbox (only for corner handles)
        if ((moveEvent.shiftKey || sizeLocked) && isCornerResize) {
          // Use the larger delta to determine the resize amount
          const absDeltaX = Math.abs(deltaX)
          const absDeltaY = Math.abs(deltaY)

          if (absDeltaX > absDeltaY) {
            // Width is the primary dimension
            if (direction.includes('left')) {
              newWidth = Math.max(20, initialWidth - deltaX)
              newX = initialX + (initialWidth - newWidth)
            } else {
              newWidth = Math.max(20, initialWidth + deltaX)
            }
            newHeight = Math.max(20, newWidth / aspectRatio)

            // Adjust Y position for top handles
            if (direction.includes('top')) {
              newY = initialY + initialHeight - newHeight
            }
          } else {
            // Height is the primary dimension
            if (direction.includes('top')) {
              newHeight = Math.max(20, initialHeight - deltaY)
              newY = initialY + (initialHeight - newHeight)
            } else {
              newHeight = Math.max(20, initialHeight + deltaY)
            }
            newWidth = Math.max(20, newHeight * aspectRatio)

            // Adjust X position for left handles
            if (direction.includes('left')) {
              newX = initialX + initialWidth - newWidth
            }
          }
        } else {
          // Original non-proportional resize logic

          // Handle LEFT edge
          if (direction.includes('left')) {
            newWidth = Math.max(20, initialWidth - deltaX)
            newX = initialX + deltaX

            if (isGridVisible) {
              newX = Math.round((newX - gridOffsetX) / gridSize) * gridSize + gridOffsetX
              newWidth = Math.max(20, initialWidth - (newX - initialX))
            } else {
              // Snap left edge to other artworks' left edges
              for (const otherArtwork of sameWallArtworks) {
                if (Math.abs(newX - otherArtwork.posX2d) <= SNAP_TOLERANCE) {
                  newX = otherArtwork.posX2d
                  newWidth = Math.max(20, initialX + initialWidth - newX)
                  alignedPairs.push({
                    from: artworkId,
                    to: otherArtwork.artworkId,
                    direction: 'left',
                  })
                  break
                }
              }
            }
          }

          // Handle RIGHT edge
          if (direction.includes('right')) {
            newWidth = Math.max(20, initialWidth + deltaX)
            const newRight = newX + newWidth

            if (isGridVisible) {
              newWidth =
                Math.round((newX + newWidth - gridOffsetX) / gridSize) * gridSize -
                newX +
                gridOffsetX
            } else {
              // Snap right edge to other artworks' right edges
              for (const otherArtwork of sameWallArtworks) {
                const otherRight = otherArtwork.posX2d + otherArtwork.width2d
                if (Math.abs(newRight - otherRight) <= SNAP_TOLERANCE) {
                  newWidth = Math.max(20, otherRight - newX)
                  alignedPairs.push({
                    from: artworkId,
                    to: otherArtwork.artworkId,
                    direction: 'right',
                  })
                  break
                }
              }
            }
          }

          // Handle TOP edge
          if (direction.includes('top')) {
            newHeight = Math.max(20, initialHeight - deltaY)
            newY = initialY + deltaY

            if (isGridVisible) {
              newY = Math.round((newY - gridOffsetY) / gridSize) * gridSize + gridOffsetY
              newHeight = Math.max(20, initialHeight - (newY - initialY))
            } else {
              // Snap top edge to other artworks' top edges
              for (const otherArtwork of sameWallArtworks) {
                if (Math.abs(newY - otherArtwork.posY2d) <= SNAP_TOLERANCE) {
                  newY = otherArtwork.posY2d
                  newHeight = Math.max(20, initialY + initialHeight - newY)
                  alignedPairs.push({
                    from: artworkId,
                    to: otherArtwork.artworkId,
                    direction: 'top',
                  })
                  break
                }
              }
            }
          }

          // Handle BOTTOM edge
          if (direction.includes('bottom')) {
            newHeight = Math.max(20, initialHeight + deltaY)
            const newBottom = newY + newHeight

            if (isGridVisible) {
              newHeight =
                Math.round((newY + newHeight - gridOffsetY) / gridSize) * gridSize -
                newY +
                gridOffsetY
            } else {
              // Snap bottom edge to other artworks' bottom edges
              for (const otherArtwork of sameWallArtworks) {
                const otherBottom = otherArtwork.posY2d + otherArtwork.height2d
                if (Math.abs(newBottom - otherBottom) <= SNAP_TOLERANCE) {
                  newHeight = Math.max(20, otherBottom - newY)
                  alignedPairs.push({
                    from: artworkId,
                    to: otherArtwork.artworkId,
                    direction: 'bottom',
                  })
                  break
                }
              }
            }
          }
        }

        // Update aligned pairs for visual feedback
        dispatch(setAlignedPairs(alignedPairs))

        if (boundingData) {
          const artworkPosition = {
            posX2d: newX,
            posY2d: newY,
            width2d: newWidth,
            height2d: newHeight,
          }

          const new3DCoordinate = convert2DTo3D(newX, newY, newWidth, newHeight, boundingData)

          dispatch(
            updateArtworkPosition({
              artworkId,
              artworkPosition: { ...artworkPosition, ...new3DCoordinate },
            }),
          )
        }
      }

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)

        // Clear resize state and alignment pairs
        dispatch(stopResizing())
        dispatch(clearAlignedPairs())
        isResizingRef.current = false
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [
      exhibitionArtworksById,
      allExhibitionArtworkIds,
      currentWallId,
      wallRef,
      gridSize,
      scaleFactor,
      isGridVisible,
      sizeLocked,
      boundingData,
      dispatch,
    ],
  )

  return useMemo(
    () => ({
      handleResize,
    }),
    [handleResize],
  )
}
