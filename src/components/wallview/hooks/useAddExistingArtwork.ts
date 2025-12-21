import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D } from '@/components/wallview/utils'
import { restoreArtwork } from '@/redux/slices/artworkSlice'
import { createArtworkPosition } from '@/redux/slices/exhibitionSlice'
import {
  chooseCurrentArtworkId,
  addArtworkToGroup,
  removeGroup,
} from '@/redux/slices/wallViewSlice'
import { showWizard } from '@/redux/slices/wizardSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork, TArtworkPosition } from '@/types/artwork'
import type { TDimensions } from '@/types/geometry'

export const useAddExistingArtwork = (boundingData: TDimensions | null) => {
  const dispatch = useDispatch()
  const initialSize = 100

  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)
  const currentWallId = useSelector((s: RootState) => s.wallView.currentWallId)

  // Get artworks already in this exhibition (across all walls)
  const exhibitionArtworkIds = useSelector((state: RootState) => state.artworks.allIds)

  // Check if artwork already exists in exhibition
  const isArtworkInExhibition = useCallback(
    (artworkId: string) => exhibitionArtworkIds.includes(artworkId),
    [exhibitionArtworkIds],
  )

  // Add existing artwork at center
  const handleAddExistingArtwork = useCallback(
    async (artworkId: string): Promise<boolean> => {
      // Check for duplicates
      if (isArtworkInExhibition(artworkId)) {
        alert('This artwork already exists in your exhibition.')
        return false
      }

      if (!boundingData || !wallWidth || !wallHeight || !currentWallId) return false

      // Fetch artwork data from API
      const response = await fetch(`/api/artworks/${artworkId}`)
      if (!response.ok) {
        console.error('Failed to fetch artwork')
        return false
      }
      const artworkData = await response.json()

      const posX2d = (wallWidth * 100) / 2 - initialSize / 2
      const posY2d = (wallHeight * 100) / 2 - initialSize / 2

      // Restore artwork to Redux with full data
      const artwork: TArtwork = {
        id: artworkData.id,
        name: artworkData.name,
        artworkType: artworkData.artworkType as 'image' | 'text',
        artworkTitle: artworkData.title || undefined,
        author: artworkData.author || undefined,
        artworkYear: artworkData.year || undefined,
        artworkDimensions: artworkData.dimensions || undefined,
        description: artworkData.description || undefined,
        imageUrl: artworkData.imageUrl || undefined,
      }

      dispatch(restoreArtwork(artwork))
      dispatch(showWizard())
      dispatch(chooseCurrentArtworkId(artworkId))
      dispatch(removeGroup())
      dispatch(addArtworkToGroup(artworkId))

      const new3DCoordinate = convert2DTo3D(posX2d, posY2d, initialSize, initialSize, boundingData)

      const artworkPosition: TArtworkPosition = {
        id: artworkId,
        artworkId,
        wallId: currentWallId,
        posX2d,
        posY2d,
        width2d: initialSize,
        height2d: initialSize,
        ...new3DCoordinate,
      }

      dispatch(createArtworkPosition({ artworkId, artworkPosition }))
      return true
    },
    [
      boundingData,
      wallWidth,
      wallHeight,
      dispatch,
      currentWallId,
      initialSize,
      isArtworkInExhibition,
    ],
  )

  // Add existing artwork at specific position (for drag-drop)
  const handleAddExistingArtworkDrag = useCallback(
    async (artworkId: string, posX2d: number, posY2d: number): Promise<boolean> => {
      // Check for duplicates
      if (isArtworkInExhibition(artworkId)) {
        alert('This artwork already exists in your exhibition.')
        return false
      }

      if (!boundingData || !currentWallId) return false

      // Fetch artwork data from API
      const response = await fetch(`/api/artworks/${artworkId}`)
      if (!response.ok) {
        console.error('Failed to fetch artwork')
        return false
      }
      const artworkData = await response.json()

      const adjustedX = posX2d - initialSize / 2
      const adjustedY = posY2d - initialSize / 2

      // Restore artwork to Redux with full data
      const artwork: TArtwork = {
        id: artworkData.id,
        name: artworkData.name,
        artworkType: artworkData.artworkType as 'image' | 'text',
        artworkTitle: artworkData.title || undefined,
        author: artworkData.author || undefined,
        artworkYear: artworkData.year || undefined,
        artworkDimensions: artworkData.dimensions || undefined,
        description: artworkData.description || undefined,
        imageUrl: artworkData.imageUrl || undefined,
      }

      dispatch(restoreArtwork(artwork))
      dispatch(showWizard())
      dispatch(chooseCurrentArtworkId(artworkId))
      dispatch(removeGroup())
      dispatch(addArtworkToGroup(artworkId))

      const new3DCoordinate = convert2DTo3D(
        adjustedX,
        adjustedY,
        initialSize,
        initialSize,
        boundingData,
      )

      const artworkPosition: TArtworkPosition = {
        id: artworkId,
        artworkId,
        wallId: currentWallId,
        posX2d: adjustedX,
        posY2d: adjustedY,
        width2d: initialSize,
        height2d: initialSize,
        ...new3DCoordinate,
      }

      dispatch(createArtworkPosition({ artworkId, artworkPosition }))
      return true
    },
    [boundingData, dispatch, currentWallId, initialSize, isArtworkInExhibition],
  )

  return {
    handleAddExistingArtwork,
    handleAddExistingArtworkDrag,
    isArtworkInExhibition,
  }
}
