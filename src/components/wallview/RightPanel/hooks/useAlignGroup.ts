import { useDispatch, useSelector } from 'react-redux'

import { convert2DTo3D, getVisualBounds } from '@/components/wallview/utils'
import { updateArtworkPosition, pushToHistory } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'
import type { TAlign } from '@/types/wizard'

export const useAlignGroup = (boundingData: TDimensions | null) => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const artworkGroup = useSelector((state: RootState) => state.wallView.artworkGroup)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const artworksById = useSelector((state: RootState) => state.artworks.byId)

  const alignArtworksInGroup = (alignment: TAlign) => {
    const { groupX, groupY, groupWidth, groupHeight } = artworkGroup

    dispatch(pushToHistory()) // Save state before group alignment

    artworkGroupIds.forEach((artworkId) => {
      const artwork = exhibitionArtworksById[artworkId]

      if (artwork) {
        // Compute visual bounds to align by visual edges
        const vb = getVisualBounds(artwork, artworksById[artwork.artworkId])
        const offsetX = artwork.posX2d - vb.x
        const offsetY = artwork.posY2d - vb.y

        let newX = artwork.posX2d
        let newY = artwork.posY2d

        switch (alignment) {
          case 'verticalTop':
            newY = groupY + offsetY
            break
          case 'verticalCenter':
            newY = groupY + groupHeight / 2 - vb.height / 2 + offsetY
            break
          case 'verticalBottom':
            newY = groupY + groupHeight - vb.height + offsetY
            break
          case 'horizontalLeft':
            newX = groupX + offsetX
            break
          case 'horizontalCenter':
            newX = groupX + groupWidth / 2 - vb.width / 2 + offsetX
            break
          case 'horizontalRight':
            newX = groupX + groupWidth - vb.width + offsetX
            break
          default:
            break
        }

        const artworkPosition = {
          posX2d: newX,
          posY2d: newY,
          width2d: artwork.width2d,
          height2d: artwork.height2d,
        }

        if (boundingData) {
          const new3DCoordinate = convert2DTo3D(
            newX,
            newY,
            artwork.width2d,
            artwork.height2d,
            boundingData,
          )
          dispatch(
            updateArtworkPosition({
              artworkId,
              artworkPosition: { ...artworkPosition, ...new3DCoordinate },
            }),
          )
        }
      }
    })
  }

  return {
    alignArtworksInGroup,
  }
}
