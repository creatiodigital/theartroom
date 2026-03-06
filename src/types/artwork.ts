// Re-export shared types from fonts.ts for backward compatibility
export type { TFontFamily, TFontWeight, TTextAlign, TOption } from '@/types/fonts'

import type { TFontFamily, TFontWeight, TOption } from '@/types/fonts'

export type TArtworkKind = 'image' | 'text' | 'sound' | 'shape'

export type TArtworkPosition = {
  id?: string
  artworkId: string
  exhibitionId?: string
  wallId: string
  posX2d: number
  posY2d: number
  width2d: number
  height2d: number
  posX3d: number
  posY3d: number
  posZ3d: number
  width3d?: number
  height3d?: number
  rotation?: number
  quaternionX: number
  quaternionY: number
  quaternionZ: number
  quaternionW: number
  locked?: boolean
}

export type TArtwork = {
  id: string
  name: string
  artworkType?: TArtworkKind
  artworkTitle?: string
  author?: string
  artworkDimensions?: string
  artworkYear?: string
  technique?: string
  description?: string
  imageUrl?: string
  originalWidth?: number | null
  originalHeight?: number | null
  showArtworkInformation?: boolean
  showFrame?: boolean
  frameColor?: string
  frameSize?: TOption<number> // Border width (XY)
  frameThickness?: TOption<number> // Z-depth
  frameMaterial?: string
  frameCornerStyle?: string
  frameTextureScale?: number
  frameTextureOffsetX?: number
  frameTextureOffsetY?: number
  frameTextureRotation?: number
  frameTextureRoughness?: number
  frameTextureTemperature?: number
  showPassepartout?: boolean
  passepartoutColor?: string
  passepartoutSize?: TOption<number> // Border width (XY)
  passepartoutThickness?: TOption<number> // Z-depth in 3D
  showSupport?: boolean // Whether support is visible
  supportThickness?: TOption<number> // Canvas/panel depth in cm
  supportColor?: string // Edge color
  textContent?: string
  fontFamily?: TOption<TFontFamily>
  fontSize?: TOption<number>
  fontWeight?: TOption<TFontWeight>
  letterSpacing?: TOption<number>
  lineHeight?: TOption<number>
  textColor?: string
  textBackgroundColor?: string
  textAlign?: 'left' | 'right' | 'center' | 'justify'
  textVerticalAlign?: 'top' | 'center' | 'bottom'
  textPadding?: TOption<number>
  textPaddingTop?: TOption<number>
  textPaddingBottom?: TOption<number>
  textPaddingLeft?: TOption<number>
  textPaddingRight?: TOption<number>
  textThickness?: TOption<number>
  textBackgroundTexture?: string // e.g. 'paper', 'cardboard' — runtime only, no DB field yet
  showTextBorder?: boolean // Decorative inset border toggle
  textBorderColor?: string // Border color (default gold #c9a96e)
  textBorderOffset?: TOption<number> // Inset distance in cm
  showMonogram?: boolean
  monogramColor?: string
  monogramOpacity?: TOption<number>
  monogramPosition?: 'top' | 'bottom'
  monogramOffset?: TOption<number>
  monogramSize?: TOption<number> // Distance from edge as % of card height
  featured?: boolean
  hiddenFromExhibition?: boolean
  hideShadow?: boolean
  // Sound artwork settings (exhibition-level)
  soundUrl?: string // URL of the audio file
  soundIcon?: string // Lucide icon name to display
  soundPlayMode?: 'loop' | 'play-once' // Playback mode
  soundSpatial?: boolean // 3D spatial audio
  soundDistance?: number // Reference distance for spatial audio falloff
  soundBackgroundColor?: string | null // Background color of the sound object
  soundIconColor?: string // Icon color
  soundIconSize?: number // Icon size (px in 2D)
  // Shape decoration properties (only when artworkType = 'shape')
  shapeType?: string // 'rectangle' | 'circle'
  shapeColor?: string
  shapeOpacity?: number
}
