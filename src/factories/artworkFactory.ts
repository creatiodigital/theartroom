import type { TArtwork, TArtworkKind } from '@/types/artwork'

export const createNewArtwork = ({
  id,
  artworkType,
}: {
  id: string
  artworkType: TArtworkKind
}): TArtwork => {
  return {
    id,
    name: '',
    artworkType,
    artworkTitle: '',
    author: '',
    artworkDimensions: '',
    artworkYear: '',
    description: '',
    imageUrl: '',
    showArtworkInformation: false,
    showFrame: false,
    frameColor: '#000000',
    frameSize: { label: '3', value: 3 },
    frameThickness: { label: '2', value: 2 },
    showPassepartout: false,
    passepartoutColor: '#ffffff',
    passepartoutSize: { label: '5', value: 5 },
    passepartoutThickness: { label: '0.6', value: 0.6 },
    showPaperBorder: false,
    paperBorderSize: { label: '0', value: 0 },
    showSupport: false,
    supportThickness: { label: '2', value: 2 },
    supportColor: '#ffffff',
    textContent: '',
    fontFamily: { label: 'Roboto', value: 'roboto' },
    fontSize: { label: '16', value: 16 },
    fontWeight: { label: 'Regular', value: 'regular' },
    letterSpacing: { label: '1', value: 1 },
    lineHeight: { label: '1', value: 1 },
    textColor: '#000000',
    textBackgroundColor: undefined,
    textAlign: 'left',
    textVerticalAlign: 'top',
    featured: false,
    hiddenFromExhibition: false,
    hideShadow: false,
    // Shape decoration defaults
    shapeType: 'rectangle',
    shapeColor: '#000000',
    shapeOpacity: 1,
    // Video defaults
    videoUrl: '',
    videoPlayMode: 'proximity',
    videoLoop: true,
    videoVolume: 1.0,
    videoProximityDistance: 3,
  }
}
