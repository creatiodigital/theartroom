import { useDispatch, useSelector } from 'react-redux'

import { editArtisticText } from '@/redux/slices/artworkSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

// Default text styling values
const DEFAULT_FONT_SIZE = 16
const DEFAULT_LINE_HEIGHT = 1.4
const DEFAULT_FONT_FAMILY = 'roboto' as const
const DEFAULT_FONT_WEIGHT = 'regular' as const
const DEFAULT_LETTER_SPACING = 0

export const useArtisticText = (artworkId: string) => {
  const dispatch = useDispatch()
  const byId = useSelector((state: RootState) => state.artworks.byId)
  const artwork = byId[artworkId] as TArtwork | undefined

  if (!artwork) {
    throw new Error(`No artwork found for id ${artworkId}`)
  }

  const {
    textContent,
    textAlign = 'left',
    textColor = '#000000',
    fontSize,
    lineHeight,
    fontFamily,
    fontWeight,
    letterSpacing,
  } = artwork

  const handleArtisticTextChange = (updatedText: string) => {
    dispatch(
      editArtisticText({
        currentArtworkId: artworkId,
        property: 'textContent',
        value: updatedText,
      }),
    )
  }

  return {
    textContent,
    textAlign,
    textColor,
    fontSize: fontSize?.value ?? DEFAULT_FONT_SIZE,
    lineHeight: lineHeight?.value ?? DEFAULT_LINE_HEIGHT,
    fontFamily: fontFamily?.value ?? DEFAULT_FONT_FAMILY,
    fontWeight: fontWeight?.value ?? DEFAULT_FONT_WEIGHT,
    letterSpacing: letterSpacing?.value ?? DEFAULT_LETTER_SPACING,
    handleArtisticTextChange,
  }
}
