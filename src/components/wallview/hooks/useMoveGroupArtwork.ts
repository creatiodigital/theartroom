import { useState, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { WALL_SCALE } from '@/components/wallview/constants'
import { convert2DTo3D, getVisualBounds } from '@/components/wallview/utils'
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

import { areAligned } from './helpers'

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
  const allExhibitionArtworkIds = useSelector(
    (state: RootState) => state.exhibition.allExhibitionArtworkIds,
  )
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const isSnapEnabled = useSelector((state: RootState) => state.wallView.isSnapEnabled)
  const guides = useSelector((state: RootState) => state.wallView.guides)

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

      // Snap tolerance scales inversely with zoom — tighter at high zoom
      const tolerance = 2 / scaleFactor
      const alignedPairs: TAlignmentPair[] = []

      const groupWidth = artworkGroup.groupWidth ?? 0
      const groupHeight = artworkGroup.groupHeight ?? 0

      // ---- Group-to-artwork alignment ----
      // Treat the group bounding box as a virtual artwork and check against non-group artworks
      const nonGroupArtworks = allExhibitionArtworkIds
        .filter(
          (id) =>
            !artworkGroupIds.includes(id) && exhibitionArtworksById[id]?.wallId === currentWallId,
        )
        .map((id) => ({
          pos: exhibitionArtworksById[id],
          visual: getVisualBounds(
            exhibitionArtworksById[id],
            artworksById[exhibitionArtworksById[id].artworkId],
          ),
        }))

      for (const { visual: otherVisual, pos: otherPos } of nonGroupArtworks) {
        const alignment = areAligned(
          { x, y, width: groupWidth, height: groupHeight },
          {
            x: otherVisual.x,
            y: otherVisual.y,
            width: otherVisual.width,
            height: otherVisual.height,
          },
          tolerance,
        )

        if (alignment.horizontal.length > 0 && isSnapEnabled) {
          const firstH = alignment.horizontal[0]
          if (firstH === 'top') {
            y = otherVisual.y
          } else if (firstH === 'bottom') {
            y = otherVisual.y + otherVisual.height - groupHeight
          } else if (firstH === 'center-horizontal') {
            y = otherVisual.y + otherVisual.height / 2 - groupHeight / 2
          }
        }

        if (alignment.vertical.length > 0 && isSnapEnabled) {
          const firstV = alignment.vertical[0]
          if (firstV === 'left') {
            x = otherVisual.x
          } else if (firstV === 'right') {
            x = otherVisual.x + otherVisual.width - groupWidth
          } else if (firstV === 'center-vertical') {
            x = otherVisual.x + otherVisual.width / 2 - groupWidth / 2
          }
        }

        // Record alignment pairs for visual feedback
        alignment.horizontal.forEach((dir) => {
          alignedPairs.push({ from: '__group__', to: otherPos.artworkId, direction: dir })
        })
        alignment.vertical.forEach((dir) => {
          alignedPairs.push({ from: '__group__', to: otherPos.artworkId, direction: dir })
        })
      }

      // Check wall center alignment for the group
      const wallWidth2d = boundingData.width * WALL_SCALE
      const wallHeight2d = boundingData.height * WALL_SCALE

      // Vertical center (group centered horizontally with wall)
      const groupCenterX = x + groupWidth / 2
      const wallCenterX = wallWidth2d / 2

      if (Math.abs(groupCenterX - wallCenterX) <= tolerance) {
        if (isSnapEnabled) {
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
        if (isSnapEnabled) {
          y = wallCenterY - groupHeight / 2
        }
        alignedPairs.push({
          from: '__group__',
          to: '__wall__',
          direction: 'center-horizontal',
        })
      }

      dispatch(setAlignedPairs(alignedPairs))

      // ---- Guide snapping for group ----
      if (isSnapEnabled) {
        const wallHeight2dG = boundingData.height * WALL_SCALE
        guides.forEach((guide) => {
          if (guide.orientation === 'vertical') {
            const guidePx = guide.position * WALL_SCALE
            const gLeft = x
            const gRight = x + groupWidth
            const gCenterX = x + groupWidth / 2
            if (Math.abs(gLeft - guidePx) <= tolerance) {
              x = guidePx
            } else if (Math.abs(gRight - guidePx) <= tolerance) {
              x = guidePx - groupWidth
            } else if (Math.abs(gCenterX - guidePx) <= tolerance) {
              x = guidePx - groupWidth / 2
            }
          } else {
            const guidePx = wallHeight2dG - guide.position * WALL_SCALE
            const gTop = y
            const gBottom = y + groupHeight
            const gCenterY = y + groupHeight / 2
            if (Math.abs(gTop - guidePx) <= tolerance) {
              y = guidePx
            } else if (Math.abs(gBottom - guidePx) <= tolerance) {
              y = guidePx - groupHeight
            } else if (Math.abs(gCenterY - guidePx) <= tolerance) {
              y = guidePx - groupHeight / 2
            }
          }
        })
      }

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
      allExhibitionArtworkIds,
      exhibitionArtworksById,
      artworksById,
      currentWallId,
      isSnapEnabled,
      guides,
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
