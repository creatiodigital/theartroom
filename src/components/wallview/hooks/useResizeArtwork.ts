import { useCallback, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D, getVisualBounds } from '@/components/wallview/utils'
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

const SNAP_TOLERANCE = 0.5 // Pixel-perfect alignment for proportional resize

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
  const sizeLockedById = useSelector((state: RootState) => state.wallView.sizeLockedById)
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
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

      // Get other artworks on the same wall for snapping (use visual bounds)
      const sameWallArtworks = allExhibitionArtworkIds
        .filter((id) => id !== artworkId && exhibitionArtworksById[id].wallId === currentWallId)
        .map((id) => ({
          pos: exhibitionArtworksById[id],
          visual: getVisualBounds(
            exhibitionArtworksById[id],
            artworksById[exhibitionArtworksById[id].artworkId],
          ),
        }))

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
        const sizeLocked = sizeLockedById[artworkId] ?? false
        if ((moveEvent.shiftKey || sizeLocked) && isCornerResize) {
          // Calculate scale factor based on diagonal movement for smooth proportional resize
          // Determine the direction signs based on which corner handle is being dragged
          const xSign = direction.includes('left') ? -1 : 1
          const ySign = direction.includes('top') ? -1 : 1

          // Project the mouse movement onto the diagonal direction
          // This gives a smooth scale factor without sudden jumps
          const diagonalDelta = (deltaX * xSign + deltaY * ySign * aspectRatio) / (1 + aspectRatio)

          // Apply the scale
          newWidth = Math.max(5, initialWidth + diagonalDelta * xSign)
          newHeight = Math.max(5, newWidth / aspectRatio)

          // Adjust position for left/top handles
          if (direction.includes('left')) {
            newX = initialX + initialWidth - newWidth
          }
          if (direction.includes('top')) {
            newY = initialY + initialHeight - newHeight
          }

          // Add edge snapping for proportional resize to show alignment lines
          // Only check edges that are actually moving based on the resize direction
          if (!isGridVisible) {
            for (const { visual: otherVisual, pos: otherPos } of sameWallArtworks) {
              const newRight = newX + newWidth
              const newBottom = newY + newHeight
              const otherRight = otherVisual.x + otherVisual.width
              const otherBottom = otherVisual.y + otherVisual.height

              // Only check left edge if dragging from left side
              if (direction.includes('left') && Math.abs(newX - otherVisual.x) <= SNAP_TOLERANCE) {
                alignedPairs.push({ from: artworkId, to: otherPos.artworkId, direction: 'left' })
              }
              // Only check right edge if dragging from right side
              if (
                direction.includes('right') &&
                Math.abs(newRight - otherRight) <= SNAP_TOLERANCE
              ) {
                alignedPairs.push({ from: artworkId, to: otherPos.artworkId, direction: 'right' })
              }
              // Only check top edge if dragging from top side
              if (direction.includes('top') && Math.abs(newY - otherVisual.y) <= SNAP_TOLERANCE) {
                alignedPairs.push({ from: artworkId, to: otherPos.artworkId, direction: 'top' })
              }
              // Only check bottom edge if dragging from bottom side
              if (
                direction.includes('bottom') &&
                Math.abs(newBottom - otherBottom) <= SNAP_TOLERANCE
              ) {
                alignedPairs.push({ from: artworkId, to: otherPos.artworkId, direction: 'bottom' })
              }
            }
          }
        } else {
          // Original non-proportional resize logic

          // Handle LEFT edge
          if (direction.includes('left')) {
            newWidth = Math.max(5, initialWidth - deltaX)
            newX = initialX + deltaX

            if (isGridVisible) {
              newX = Math.round((newX - gridOffsetX) / gridSize) * gridSize + gridOffsetX
              newWidth = Math.max(5, initialWidth - (newX - initialX))
            } else {
              // Snap left edge to other artworks' left edges
              for (const { visual: otherVisual, pos: otherPos } of sameWallArtworks) {
                if (Math.abs(newX - otherVisual.x) <= SNAP_TOLERANCE) {
                  newX = otherVisual.x
                  newWidth = Math.max(5, initialX + initialWidth - newX)
                  alignedPairs.push({
                    from: artworkId,
                    to: otherPos.artworkId,
                    direction: 'left',
                  })
                  break
                }
              }
            }
          }

          // Handle RIGHT edge
          if (direction.includes('right')) {
            newWidth = Math.max(5, initialWidth + deltaX)
            const newRight = newX + newWidth

            if (isGridVisible) {
              newWidth =
                Math.round((newX + newWidth - gridOffsetX) / gridSize) * gridSize -
                newX +
                gridOffsetX
            } else {
              // Snap right edge to other artworks' right edges
              for (const { visual: otherVisual, pos: otherPos } of sameWallArtworks) {
                const otherRight = otherVisual.x + otherVisual.width
                if (Math.abs(newRight - otherRight) <= SNAP_TOLERANCE) {
                  newWidth = Math.max(5, otherRight - newX)
                  alignedPairs.push({
                    from: artworkId,
                    to: otherPos.artworkId,
                    direction: 'right',
                  })
                  break
                }
              }
            }
          }

          // Handle TOP edge
          if (direction.includes('top')) {
            newHeight = Math.max(5, initialHeight - deltaY)
            newY = initialY + deltaY

            if (isGridVisible) {
              newY = Math.round((newY - gridOffsetY) / gridSize) * gridSize + gridOffsetY
              newHeight = Math.max(5, initialHeight - (newY - initialY))
            } else {
              // Snap top edge to other artworks' top edges
              for (const { visual: otherVisual, pos: otherPos } of sameWallArtworks) {
                if (Math.abs(newY - otherVisual.y) <= SNAP_TOLERANCE) {
                  newY = otherVisual.y
                  newHeight = Math.max(5, initialY + initialHeight - newY)
                  alignedPairs.push({
                    from: artworkId,
                    to: otherPos.artworkId,
                    direction: 'top',
                  })
                  break
                }
              }
            }
          }

          // Handle BOTTOM edge
          if (direction.includes('bottom')) {
            newHeight = Math.max(5, initialHeight + deltaY)
            const newBottom = newY + newHeight

            if (isGridVisible) {
              newHeight =
                Math.round((newY + newHeight - gridOffsetY) / gridSize) * gridSize -
                newY +
                gridOffsetY
            } else {
              // Snap bottom edge to other artworks' bottom edges
              for (const { visual: otherVisual, pos: otherPos } of sameWallArtworks) {
                const otherBottom = otherVisual.y + otherVisual.height
                if (Math.abs(newBottom - otherBottom) <= SNAP_TOLERANCE) {
                  newHeight = Math.max(5, otherBottom - newY)
                  alignedPairs.push({
                    from: artworkId,
                    to: otherPos.artworkId,
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
      sizeLockedById,
      artworksById,
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
