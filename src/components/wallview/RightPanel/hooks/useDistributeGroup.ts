import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
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

    // Calculate group bounds from sorted artworks
    const xValues = groupedArtworks.map(({ artwork }) => artwork.posX2d)
    const xEdgeValues = groupedArtworks.map(({ artwork }) => artwork.posX2d + artwork.width2d)
    const yValues = groupedArtworks.map(({ artwork }) => artwork.posY2d)
    const yEdgeValues = groupedArtworks.map(({ artwork }) => artwork.posY2d + artwork.height2d)

    const groupX = Math.min(...xValues)
    const groupY = Math.min(...yValues)
    const groupWidth = Math.max(...xEdgeValues) - groupX
    const groupHeight = Math.max(...yEdgeValues) - groupY

    dispatch(pushToHistory()) // Save state before distribute

    // Calculate total dimensions and spacing
    const artworkTotalWidth = groupedArtworks.reduce((total, { artwork }) => total + artwork.width2d, 0)
    const artworkTotalHeight = groupedArtworks.reduce(
      (total, { artwork }) => total + artwork.height2d,
      0,
    )

    const gapsBetweenArtworks = groupedArtworks.length - 1

    const horizontalSpacing =
      gapsBetweenArtworks > 0 ? (groupWidth - artworkTotalWidth) / gapsBetweenArtworks : 0
    const verticalSpacing =
      gapsBetweenArtworks > 0 ? (groupHeight - artworkTotalHeight) / gapsBetweenArtworks : 0

    const horizontalPositions: number[] = []
    const verticalPositions: number[] = []

    if (alignment === 'horizontal') {
      let currentX = groupX
      groupedArtworks.forEach(({ artwork }) => {
        horizontalPositions.push(currentX)
        currentX += artwork.width2d + horizontalSpacing
      })
    }

    if (alignment === 'vertical') {
      let currentY = groupY
      groupedArtworks.forEach(({ artwork }) => {
        verticalPositions.push(currentY)
        currentY += artwork.height2d + verticalSpacing
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
