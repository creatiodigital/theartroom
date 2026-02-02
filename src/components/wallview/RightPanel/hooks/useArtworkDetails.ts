import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'
import type { TOption } from '@/types/artwork'
import type { TFontFamily, TFontWeight } from '@/types/fonts'

export const useArtworkDetails = (currentArtworkId: string) => {
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)

  const artwork = artworksById[currentArtworkId]
  const artworkPosition = exhibitionArtworksById[currentArtworkId]

  if (!artwork || !artworkPosition) {
    return {
      name: '',
      artworkTitle: '',
      author: '',
      artworkYear: '',
      artworkDimensions: '',
      description: '',
      textContent: '',
      artworkType: '',
      showArtworkInformation: false,
      showFrame: false,
      frameColor: '#000000',
      textColor: '#000000',
      fontSize: { label: '16', value: 16 } as TOption<number>,
      lineHeight: { label: '20', value: 20 } as TOption<number>,
      fontWeight: { label: 'Regular', value: 'regular' } as TOption<TFontWeight>,
      letterSpacing: { label: '0', value: 0 } as TOption<number>,
      fontFamily: { label: 'Roboto', value: 'roboto' } as TOption<TFontFamily>,
      frameSize: { label: '3', value: 3 },
      frameThickness: { label: '1', value: 1 },
      showPassepartout: false,
      passepartoutColor: '#ffffff',
      passepartoutSize: { label: '5', value: 5 },
      passepartoutThickness: { label: '0.3', value: 0.3 },
      supportThickness: { label: '2', value: 2 },
      supportColor: '#ffffff',
      showSupport: true,
      textBackgroundColor: undefined,
      textVerticalAlign: 'top',
      textPadding: { label: '12', value: 12 } as TOption<number>,
      imageUrl: '',
      featured: false,
      hiddenFromExhibition: false,
      width: 0,
      height: 0,
      fromTop: 0,
      fromBottom: 0,
      fromLeft: 0,
      fromRight: 0,
    }
  }

  const { width2d, height2d, posX2d, posY2d } = artworkPosition
  const {
    name,
    artworkTitle,
    author,
    artworkYear,
    artworkDimensions,
    description,
    textContent,
    artworkType,
    showArtworkInformation,
    showFrame,
    frameColor,
    textColor,
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing,
    fontFamily,
    frameSize,
    frameThickness,
    showPassepartout,
    passepartoutColor,
    passepartoutSize,
    passepartoutThickness,
    supportThickness,
    supportColor,
    showSupport,
    textBackgroundColor,
    textVerticalAlign,
    textPadding,
    featured,
    hiddenFromExhibition,
    imageUrl,
  } = artwork

  // Wall dimensions in 2D scale (meters * 100)
  const wallWidth2d = (wallWidth || 0) * 100
  const wallHeight2d = (wallHeight || 0) * 100

  // Calculate artwork center position
  const centerX = posX2d + width2d / 2
  const centerY = posY2d + height2d / 2

  // Calculate distances from all 4 wall edges to artwork center
  const fromTop = centerY
  const fromBottom = wallHeight2d - centerY
  const fromLeft = centerX
  const fromRight = wallWidth2d - centerX

  return {
    width: Math.round(width2d),
    height: Math.round(height2d),
    fromTop: Math.round(fromTop),
    fromBottom: Math.round(fromBottom),
    fromLeft: Math.round(fromLeft),
    fromRight: Math.round(fromRight),
    name,
    artworkTitle,
    author,
    artworkYear,
    artworkDimensions,
    description,
    textContent,
    artworkType,
    showArtworkInformation,
    showFrame,
    frameColor,
    textColor,
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing,
    fontFamily,
    frameSize: frameSize ?? { label: '3', value: 3 },
    frameThickness: frameThickness ?? { label: '1', value: 1 },
    showPassepartout,
    passepartoutColor,
    passepartoutSize: passepartoutSize ?? { label: '5', value: 5 },
    passepartoutThickness: passepartoutThickness ?? { label: '0.3', value: 0.3 },
    supportThickness: supportThickness ?? { label: '2', value: 2 },
    supportColor: supportColor ?? '#ffffff',
    showSupport: showSupport ?? true,
    textBackgroundColor,
    textVerticalAlign,
    textPadding,
    featured,
    hiddenFromExhibition,
    imageUrl,
  }
}
