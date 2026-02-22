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
const DEFAULT_TEXT_PADDING = 0

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
    textVerticalAlign = 'top',
    textColor = '#000000',
    textBackgroundColor,
    fontSize,
    lineHeight,
    fontFamily,
    fontWeight,
    letterSpacing,
    textPadding,
    textPaddingTop,
    textPaddingBottom,
    textPaddingLeft,
    textPaddingRight,
    showTextBorder,
    textBorderColor,
    textBorderOffset,
    showMonogram,
    monogramColor,
    monogramOpacity,
    monogramPosition,
    monogramOffset,
    monogramSize,
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
    textVerticalAlign,
    textColor,
    textBackgroundColor,
    fontSize: fontSize?.value ?? DEFAULT_FONT_SIZE,
    lineHeight: lineHeight?.value ?? DEFAULT_LINE_HEIGHT,
    fontFamily: fontFamily?.value ?? DEFAULT_FONT_FAMILY,
    fontWeight: fontWeight?.value ?? DEFAULT_FONT_WEIGHT,
    letterSpacing: letterSpacing?.value ?? DEFAULT_LETTER_SPACING,
    textPadding: textPadding?.value ?? DEFAULT_TEXT_PADDING,
    textPaddingTop: textPaddingTop?.value ?? 0,
    textPaddingBottom: textPaddingBottom?.value ?? 0,
    textPaddingLeft: textPaddingLeft?.value ?? 0,
    textPaddingRight: textPaddingRight?.value ?? 0,
    showTextBorder: showTextBorder ?? false,
    textBorderColor: textBorderColor ?? '#c9a96e',
    textBorderOffset: textBorderOffset?.value ?? 1.2,
    showMonogram: showMonogram ?? false,
    monogramColor: monogramColor ?? '#c0392b',
    monogramOpacity: monogramOpacity?.value ?? 1.0,
    monogramPosition: (monogramPosition ?? 'bottom') as 'top' | 'bottom',
    monogramOffset: monogramOffset?.value ?? 2,
    monogramSize: monogramSize?.value ?? 4,
    handleArtisticTextChange,
  }
}
