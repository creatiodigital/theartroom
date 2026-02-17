import { useDispatch, useSelector } from 'react-redux'

import { editArtisticImage } from '@/redux/slices/artworkSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

export const useArtworkSoundHandlers = (currentArtworkId: string) => {
  const dispatch = useDispatch()
  const artworksById = useSelector((state: RootState) => state.artworks.byId)

  const handleEditSound = <K extends keyof TArtwork>(property: K, value: TArtwork[K]) => {
    const currentEdited = artworksById[currentArtworkId]
    if (!currentEdited) return

    dispatch(
      editArtisticImage({
        currentArtworkId,
        property,
        value,
      }),
    )
  }

  return { handleEditSound }
}
