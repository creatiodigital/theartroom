import { useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { getVisualBounds } from '@/components/wallview/utils'
import { addArtworkToGroup, removeGroup, createArtworkGroup } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

export const useGroupArtwork = () => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const artworksById = useSelector((state: RootState) => state.artworks.byId)

  const handleAddArtworkToGroup = useCallback(
    (artworkId: string) => {
      // Block locked artworks from being grouped
      if (exhibitionArtworksById[artworkId]?.locked) return
      dispatch(addArtworkToGroup(artworkId))
    },
    [dispatch, exhibitionArtworksById],
  )

  const handleCreateArtworkGroup = useCallback(() => {
    if (artworkGroupIds.length === 0) return
    const artworkGroupItems = artworkGroupIds
      .map((id) => exhibitionArtworksById[id])
      .filter(Boolean)
    if (artworkGroupItems.length === 0) return

    // Use visual bounds (including frame/passepartout) for group bounding box
    const visualBounds = artworkGroupItems.map((pos) =>
      getVisualBounds(pos, artworksById[pos.artworkId]),
    )
    const xValues = visualBounds.map((b) => b.x)
    const xEdgeValues = visualBounds.map((b) => b.x + b.width)
    const yValues = visualBounds.map((b) => b.y)
    const yEdgeValues = visualBounds.map((b) => b.y + b.height)

    const groupX = Math.min(...xValues)
    const maxGroupX = Math.max(...xEdgeValues)
    const groupY = Math.min(...yValues)
    const maxGroupY = Math.max(...yEdgeValues)
    const groupWidth = maxGroupX - groupX
    const groupHeight = maxGroupY - groupY

    const groupProps = {
      groupX,
      groupY,
      groupWidth,
      groupHeight,
    }

    dispatch(createArtworkGroup(groupProps))
  }, [artworkGroupIds, exhibitionArtworksById, artworksById, dispatch])

  const handleRemoveArtworkGroup = useCallback(() => {
    dispatch(removeGroup())
  }, [dispatch])

  useEffect(() => {
    if (artworkGroupIds.length > 0) {
      handleCreateArtworkGroup()
    }
  }, [artworkGroupIds, handleCreateArtworkGroup])

  return {
    handleAddArtworkToGroup,
    handleRemoveArtworkGroup,
  }
}
