import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D, getVisualBounds } from '@/components/wallview/utils'
import { updateArtworkPosition, pushToHistory } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'
import type { TArtworkPosition } from '@/types/artwork'
import type { TDimensions } from '@/types/geometry'
import type { TDistributeAlign } from '@/types/wizard'

export const useDistributeGroup = (boundingData: TDimensions | null) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const artworksById = useSelector((state: RootState) => state.artworks.byId)

  const distributeArtworksInGroup = (alignment: TDistributeAlign) => {
    // Get all artworks in the group with their original keys
    // The key in artworkGroupIds may differ from artwork.id, so we track both
    let groupedArtworks = artworkGroupIds
      .map((key) => {
        const artwork = exhibitionArtworksById[key]
        return artwork ? { key, artwork } : null
      })
      .filter((item): item is { key: string; artwork: TArtworkPosition } => item !== null)

    if (groupedArtworks.length < 2) return

    // Sort artworks by position FIRST (before calculating bounds)
    if (alignment === 'horizontal') {
      groupedArtworks = [...groupedArtworks].sort((a, b) => a.artwork.posX2d - b.artwork.posX2d)
    } else if (alignment === 'vertical') {
      groupedArtworks = [...groupedArtworks].sort((a, b) => a.artwork.posY2d - b.artwork.posY2d)
    }

    // Calculate group bounds from sorted artworks using visual bounds
    const visualBounds = groupedArtworks.map(({ artwork }) =>
      getVisualBounds(artwork, artworksById[artwork.artworkId]),
    )
    const xValues = visualBounds.map((b) => b.x)
    const xEdgeValues = visualBounds.map((b) => b.x + b.width)
    const yValues = visualBounds.map((b) => b.y)
    const yEdgeValues = visualBounds.map((b) => b.y + b.height)

    const groupX = Math.min(...xValues)
    const groupY = Math.min(...yValues)
    const groupWidth = Math.max(...xEdgeValues) - groupX
    const groupHeight = Math.max(...yEdgeValues) - groupY

    dispatch(pushToHistory()) // Save state before distribute

    // Calculate total visual dimensions and spacing
    const artworkTotalWidth = visualBounds.reduce((total, b) => total + b.width, 0)
    const artworkTotalHeight = visualBounds.reduce((total, b) => total + b.height, 0)

    const gapsBetweenArtworks = groupedArtworks.length - 1

    const horizontalSpacing =
      gapsBetweenArtworks > 0 ? (groupWidth - artworkTotalWidth) / gapsBetweenArtworks : 0
    const verticalSpacing =
      gapsBetweenArtworks > 0 ? (groupHeight - artworkTotalHeight) / gapsBetweenArtworks : 0

    const horizontalPositions: number[] = []
    const verticalPositions: number[] = []

    if (alignment === 'horizontal') {
      let currentX = groupX
      groupedArtworks.forEach(({ artwork }, index) => {
        // Position so that the visual left edge is at currentX
        const vb = visualBounds[index]
        const offsetX = artwork.posX2d - vb.x // how much image pos is offset from visual edge
        horizontalPositions.push(currentX + offsetX)
        currentX += vb.width + horizontalSpacing
      })
    }

    if (alignment === 'vertical') {
      let currentY = groupY
      groupedArtworks.forEach(({ artwork }, index) => {
        const vb = visualBounds[index]
        const offsetY = artwork.posY2d - vb.y
        verticalPositions.push(currentY + offsetY)
        currentY += vb.height + verticalSpacing
      })
    }

    groupedArtworks.forEach(({ key, artwork }, index) => {
      let newX = artwork.posX2d
      let newY = artwork.posY2d

      switch (alignment) {
        case 'horizontal':
          newX = horizontalPositions[index]
          break
        case 'vertical':
          newY = verticalPositions[index]
          break
        default:
          break
      }

      const artworkPosition: Record<string, unknown> = {
        posX2d: newX,
        posY2d: newY,
      }

      // Add 3D coordinates if boundingData is available
      if (boundingData) {
        const new3DCoordinate = convert2DTo3D(
          newX,
          newY,
          artwork.width2d,
          artwork.height2d,
          boundingData,
        )
        Object.assign(artworkPosition, new3DCoordinate)
      }

      // Use the original key from artworkGroupIds, NOT artwork.id
      dispatch(
        updateArtworkPosition({
          artworkId: key,
          artworkPosition,
        }),
      )
    })
  }

  return {
    distributeArtworksInGroup,
  }
}
