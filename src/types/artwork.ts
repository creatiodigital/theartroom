// Re-export shared types from fonts.ts for backward compatibility
export type { TFontFamily, TFontWeight, TTextAlign, TOption } from '@/types/fonts'

import type { TFontFamily, TFontWeight, TOption } from '@/types/fonts'

export type TArtworkKind = 'image' | 'text'

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
  textAlign?: 'left' | 'right' | 'center'
  textVerticalAlign?: 'top' | 'center' | 'bottom'
  textPadding?: TOption<number>
  textThickness?: TOption<number>
  featured?: boolean
  hiddenFromExhibition?: boolean
  hideShadow?: boolean
}
