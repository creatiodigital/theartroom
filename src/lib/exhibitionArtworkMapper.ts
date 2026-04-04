import { WALL_SCALE } from '@/components/wallview/constants'
import type { TArtwork, TArtworkPosition } from '@/types/artwork'

/**
 * Raw API response shape for a single exhibition artwork.
 */
export type ExhibitionArtworkResponse = {
  id: string
  exhibitionId: string
  artworkId: string
  artwork: {
    id: string
    slug: string
    name: string
    artworkType: string
    title: string | null
    author: string | null
    year: string | null
    technique: string | null
    dimensions: string | null
    description: string | null
    imageUrl: string | null
    textContent: string | null
    soundUrl: string | null
    videoUrl: string | null
    originalWidth: number | null
    originalHeight: number | null
  }
  wallId: string
  posX2d: number
  posY2d: number
  width2d: number
  height2d: number
  posX3d: number
  posY3d: number
  posZ3d: number
  quaternionX: number
  quaternionY: number
  quaternionZ: number
  quaternionW: number
  // Display properties (per-exhibition)
  showFrame: boolean
  frameColor: string
  frameSize: number
  frameThickness: number
  frameMaterial: string
  frameCornerStyle: string
  frameTextureScale: number
  frameTextureRotation: number
  frameTextureRoughness: number
  frameTextureNormalScale: number
  showPassepartout: boolean
  passepartoutColor: string
  passepartoutSize: number
  passepartoutThickness: number
  supportThickness: number
  supportColor: string
  showSupport: boolean
  hideShadow: boolean
  showArtworkInformation: boolean
  // Text styling (per-exhibition)
  fontFamily: string
  fontSize: number
  fontWeight: string
  letterSpacing: number
  lineHeight: number
  textColor: string
  textBackgroundColor: string | null
  textAlign: string
  textVerticalAlign: string
  textPadding: number
  textPaddingTop: number
  textPaddingBottom: number
  textPaddingLeft: number
  textPaddingRight: number
  textThickness: number
  textBackgroundTexture: string | null
  showTextBorder: boolean
  textBorderColor: string
  textBorderOffset: number
  showMonogram: boolean
  monogramColor: string
  monogramOpacity: number
  monogramPosition: string
  monogramOffset: number
  monogramSize: number
  // Sound styling (per-exhibition)
  soundIcon: string
  soundBackgroundColor: string | null
  soundIconColor: string
  soundIconSize: number
  soundPlayMode: string
  soundSpatial: boolean
  soundDistance: number
  // Video styling (per-exhibition)
  videoPlayMode: string
  videoLoop: boolean
  videoVolume: number
  videoProximityDistance: number
  // Shape decoration
  shapeType: string
  shapeColor: string
  shapeOpacity: number
  rotation: number
  locked: boolean
}

// ── Font weight mapping ─────────────────────────────────────────────────────

const WEIGHT_MAP: Record<string, 'regular' | 'italic' | 'bold' | 'bold-italic'> = {
  regular: 'regular',
  italic: 'italic',
  bold: 'bold',
  'bold-italic': 'bold-italic',
  '400': 'regular',
  '700': 'bold',
}

const WEIGHT_LABEL_MAP: Record<string, string> = {
  regular: 'Regular',
  italic: 'Regular Italic',
  bold: 'Bold',
  'bold-italic': 'Bold Italic',
}

// ── Mappers ─────────────────────────────────────────────────────────────────

/**
 * Map an API ExhibitionArtwork response to the client-side TArtwork shape.
 */
export function mapToArtwork(ea: ExhibitionArtworkResponse): TArtwork {
  const mappedWeight = WEIGHT_MAP[ea.fontWeight] ?? 'regular'

  // Clamp passepartoutThickness to valid range 0.1-1.0 (old data may have invalid values)
  const passepartoutThicknessVal =
    ea.passepartoutThickness && ea.passepartoutThickness >= 0.1 && ea.passepartoutThickness <= 1.0
      ? ea.passepartoutThickness
      : 0.3

  return {
    id: ea.artworkId,
    slug: ea.artwork.slug,
    name: ea.artwork.name,
    artworkType: ea.artwork.artworkType as 'image' | 'text' | 'sound' | 'video',
    artworkTitle: ea.artwork.title || undefined,
    author: ea.artwork.author || undefined,
    artworkYear: ea.artwork.year || undefined,
    artworkDimensions: ea.artwork.dimensions || undefined,
    technique: ea.artwork.technique || undefined,
    description: ea.artwork.description || undefined,
    imageUrl: ea.artwork.imageUrl || undefined,
    originalWidth: ea.artwork.originalWidth ?? undefined,
    originalHeight: ea.artwork.originalHeight ?? undefined,
    textContent: ea.artwork.textContent || undefined,
    soundUrl: ea.artwork.soundUrl || undefined,
    videoUrl: ea.artwork.videoUrl || undefined,
    // Display properties from ExhibitionArtwork (per-exhibition)
    showFrame: ea.showFrame,
    frameColor: ea.frameColor,
    frameSize: { label: String(ea.frameSize ?? 3), value: ea.frameSize ?? 3 },
    frameThickness: { label: String(ea.frameThickness ?? 1), value: ea.frameThickness ?? 1 },
    frameMaterial: ea.frameMaterial === 'wood' ? 'wood-dark' : (ea.frameMaterial ?? 'plastic'),
    frameCornerStyle: ea.frameCornerStyle ?? 'mitered',
    frameTextureScale: ea.frameTextureScale ?? 2.0,
    frameTextureRotation: ea.frameTextureRotation ?? 0,
    frameTextureRoughness: ea.frameTextureRoughness ?? 0.6,
    frameTextureNormalScale: ea.frameTextureNormalScale ?? 0.5,
    showPassepartout: ea.showPassepartout,
    passepartoutColor: ea.passepartoutColor,
    passepartoutSize: { label: String(ea.passepartoutSize ?? 5), value: ea.passepartoutSize ?? 5 },
    passepartoutThickness: {
      label: String(passepartoutThicknessVal),
      value: passepartoutThicknessVal,
    },
    supportThickness: {
      label: String(ea.supportThickness ?? 2),
      value: ea.supportThickness ?? 2,
    },
    supportColor: ea.supportColor ?? '#ffffff',
    showSupport: ea.showSupport ?? false,
    hideShadow: ea.hideShadow ?? false,
    showArtworkInformation: ea.showArtworkInformation,
    // Text styling from ExhibitionArtwork (per-exhibition)
    fontFamily: { label: ea.fontFamily, value: ea.fontFamily.toLowerCase() as 'roboto' | 'lora' },
    fontSize: { label: String(ea.fontSize), value: ea.fontSize },
    fontWeight: { label: WEIGHT_LABEL_MAP[mappedWeight] ?? 'Regular', value: mappedWeight },
    letterSpacing: { label: String(ea.letterSpacing), value: ea.letterSpacing },
    lineHeight: { label: String(ea.lineHeight), value: ea.lineHeight },
    textColor: ea.textColor,
    textBackgroundColor: ea.textBackgroundColor ?? undefined,
    textAlign: ea.textAlign as 'left' | 'center' | 'right',
    textVerticalAlign: ea.textVerticalAlign as 'top' | 'center' | 'bottom',
    textPadding: { label: String(ea.textPadding ?? 0), value: ea.textPadding ?? 0 },
    textPaddingTop: { label: String(ea.textPaddingTop ?? 0), value: ea.textPaddingTop ?? 0 },
    textPaddingBottom: {
      label: String(ea.textPaddingBottom ?? 0),
      value: ea.textPaddingBottom ?? 0,
    },
    textPaddingLeft: { label: String(ea.textPaddingLeft ?? 0), value: ea.textPaddingLeft ?? 0 },
    textPaddingRight: { label: String(ea.textPaddingRight ?? 0), value: ea.textPaddingRight ?? 0 },
    textThickness: { label: String(ea.textThickness ?? 0), value: ea.textThickness ?? 0 },
    textBackgroundTexture: ea.textBackgroundTexture ?? undefined,
    showTextBorder: ea.showTextBorder ?? false,
    textBorderColor: ea.textBorderColor ?? '#c9a96e',
    textBorderOffset: {
      label: String(ea.textBorderOffset ?? 1.2),
      value: ea.textBorderOffset ?? 1.2,
    },
    showMonogram: ea.showMonogram ?? false,
    monogramColor: ea.monogramColor ?? '#c0392b',
    monogramOpacity: { label: String(ea.monogramOpacity ?? 1.0), value: ea.monogramOpacity ?? 1.0 },
    monogramPosition: (ea.monogramPosition ?? 'bottom') as 'top' | 'bottom',
    monogramOffset: { label: String(ea.monogramOffset ?? 2), value: ea.monogramOffset ?? 2 },
    monogramSize: { label: String(ea.monogramSize ?? 4), value: ea.monogramSize ?? 4 },
    // Sound styling from ExhibitionArtwork (per-exhibition)
    soundIcon: ea.soundIcon ?? 'volume-2',
    soundBackgroundColor: ea.soundBackgroundColor ?? undefined,
    soundIconColor: ea.soundIconColor ?? '#000000',
    soundIconSize: ea.soundIconSize ?? 24,
    soundPlayMode: (ea.soundPlayMode ?? 'play-once') as 'loop' | 'play-once',
    soundSpatial: ea.soundSpatial ?? true,
    soundDistance: ea.soundDistance ?? 5,
    // Video styling from ExhibitionArtwork (per-exhibition)
    videoPlayMode: (ea.videoPlayMode ?? 'proximity') as 'proximity' | 'always' | 'click',
    videoLoop: ea.videoLoop ?? true,
    videoVolume: ea.videoVolume ?? 1.0,
    videoProximityDistance: ea.videoProximityDistance ?? 3,
    // Shape decoration
    shapeType: ea.shapeType ?? 'rectangle',
    shapeColor: ea.shapeColor ?? '#000000',
    shapeOpacity: ea.shapeOpacity ?? 1,
  }
}

/**
 * Map an API ExhibitionArtwork response to a TArtworkPosition.
 */
export function mapToArtworkPosition(ea: ExhibitionArtworkResponse): TArtworkPosition {
  return {
    id: ea.id,
    artworkId: ea.artworkId,
    exhibitionId: ea.exhibitionId,
    wallId: ea.wallId,
    posX2d: ea.posX2d,
    posY2d: ea.posY2d,
    width2d: ea.width2d,
    height2d: ea.height2d,
    width3d: ea.width2d / WALL_SCALE,
    height3d: ea.height2d / WALL_SCALE,
    posX3d: ea.posX3d,
    posY3d: ea.posY3d,
    posZ3d: ea.posZ3d,
    quaternionX: ea.quaternionX,
    quaternionY: ea.quaternionY,
    quaternionZ: ea.quaternionZ,
    quaternionW: ea.quaternionW,
    rotation: ea.rotation ?? 0,
    locked: ea.locked ?? false,
  }
}
