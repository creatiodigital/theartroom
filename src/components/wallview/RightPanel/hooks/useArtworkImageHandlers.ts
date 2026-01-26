import { useDispatch, useSelector } from 'react-redux'

import { editArtwork, editArtisticImage } from '@/redux/slices/artworkSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

export const useArtworkImageHandlers = (currentArtworkId: string) => {
  const dispatch = useDispatch()
  const artworksById = useSelector((state: RootState) => state.artworks.byId)

  const handleEditArtwork = <K extends keyof TArtwork>(property: K, value: TArtwork[K]) => {
    const currentEdited = artworksById[currentArtworkId]
    if (!currentEdited) return

    dispatch(
      editArtwork({
        currentArtworkId,
        property,
        value,
      }),
    )
  }

  const handleEditArtisticImage = <K extends keyof TArtwork>(property: K, value: TArtwork[K]) => {
    const currentEdited = artworksById[currentArtworkId]
    if (!currentEdited) return

    dispatch(
      editArtisticImage({
        currentArtworkId,
        property,
        value,
      }),
    )

    // When enabling passepartout or frame, set defaults if not already set
    if (property === 'showPassepartout' && value === true) {
      if (!currentEdited.passepartoutSize) {
        dispatch(
          editArtisticImage({
            currentArtworkId,
            property: 'passepartoutSize',
            value: { label: '5', value: 5 },
          }),
        )
      }
      if (!currentEdited.passepartoutThickness) {
        dispatch(
          editArtisticImage({
            currentArtworkId,
            property: 'passepartoutThickness',
            value: { label: '0.3', value: 0.3 },
          }),
        )
      }
      if (!currentEdited.passepartoutColor) {
        dispatch(
          editArtisticImage({
            currentArtworkId,
            property: 'passepartoutColor',
            value: '#eeeeee',
          }),
        )
      }
    }

    if (property === 'showFrame' && value === true) {
      if (!currentEdited.frameSize) {
        dispatch(
          editArtisticImage({
            currentArtworkId,
            property: 'frameSize',
            value: { label: '3', value: 3 },
          }),
        )
      }
      if (!currentEdited.frameThickness) {
        dispatch(
          editArtisticImage({
            currentArtworkId,
            property: 'frameThickness',
            value: { label: '1', value: 1 },
          }),
        )
      }
      if (!currentEdited.frameColor) {
        dispatch(
          editArtisticImage({
            currentArtworkId,
            property: 'frameColor',
            value: '#000000',
          }),
        )
      }
    }
  }

  return {
    handleEditArtwork,
    handleEditArtisticImage,
  }
}
