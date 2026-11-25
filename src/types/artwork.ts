// Re-export shared types from fonts.ts for backward compatibility
export type { TFontFamily, TFontWeight, TOption } from '@/types/fonts'

import type {
  TLightboxEdge,
  TLightboxFront,
  TLightboxLight,
  TLightboxMaterial,
} from '@/lib/lightbox'
import type { TFontFamily, TFontWeight, TOption } from '@/types/fonts'

export type TArtworkKind = 'image' | 'text' | 'sound' | 'shape' | 'video' | 'object'

/** An Object's edition (docs/objects): one of a kind, or number N of M (+ APs). */
export type TObjectPlacement = 'indoors' | 'outdoors' | 'both'
export type TObjectDisplayMode = 'floor' | 'pedestal' | 'wall' | 'hanging'
/** The 3D model's state: none → ready (the gallery uploads the .glb the artist sent it). */
export type TObjectModelStatus = 'none' | 'ready'
/** The label of one of an Object's photos or videos (ArtworkMedia.role). */
export type TObjectMediaRole = 'front' | 'back' | 'side' | 'detail' | 'room' | 'process' | 'reel'
/** The GLB's bounding box in cm, read on upload. */
export type TObjectBoundsCm = { h: number; w: number; d: number }

/**
 * The Object fields (artworkType 'object', docs/objects/README.md "Data"). The cover photo is
 * the artwork's ordinary image (`imageUrl`, `originalWidth`/`Height`).
 */
export type TArtworkObjectFields = {
  heightCm?: number | null
  widthCm?: number | null
  depthCm?: number | null
  weightKg?: number | null
  sizeIncludesBase?: boolean
  placement?: TObjectPlacement | null
  displayMode?: TObjectDisplayMode | null
  signedNote?: string | null
  certificateNote?: string | null
  careNote?: string | null
  modelUrl?: string | null
  modelSizeBytes?: number | null
  modelBoundsCm?: TObjectBoundsCm | null
  modelStatus?: TObjectModelStatus
  modelReadyAt?: string | null
}

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
  /** Stacking order within the wall; null until explicitly reordered. */
  zOrder?: number | null
  /**
   * Page membership, not placement — whether this row shows on the
   * exhibition's public grid. Kept optional and separate from the mapper's
   * `ExhibitionArtworkResponse` contract (which stays placement-only): this
   * is threaded through by the loader purely so the wall editor can mark a
   * hung-but-off-page work, not because the 3D scene needs it.
   */
  showOnPage?: boolean
}

export type TArtwork = TArtworkObjectFields & {
  id: string
  slug?: string
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
  frameTextureRotation?: number
  frameTextureRoughness?: number
  frameTextureNormalScale?: number
  showPassepartout?: boolean
  passepartoutColor?: string
  passepartoutSize?: TOption<number> // Border width (XY)
  passepartoutThickness?: TOption<number> // Z-depth in 3D
  showPaperBorder?: boolean // Whether to show a white paper margin around the image
  paperBorderSize?: TOption<number> // Paper border width in cm, equal on all sides
  showSupport?: boolean // Whether support is visible
  supportThickness?: TOption<number> // Canvas/panel depth in cm
  supportColor?: string // Edge color
  /**
   * AR-183 Lightbox (docs/lightbox, src/lib/lightbox.ts): image artworks only, per exhibition.
   * While on, the room draws neither frame, passepartout, paper border nor support; their
   * settings are kept for when it is turned off.
   */
  showLightbox?: boolean
  lightboxBrightness?: number // 0..1, Soft..Bright
  lightboxLight?: TLightboxLight
  lightboxDepth?: number // cm, 3..15
  lightboxEdge?: TLightboxEdge
  lightboxMaterial?: TLightboxMaterial
  lightboxFront?: TLightboxFront
  textContent?: string
  /**
   * AR-182: the text's second version (docs/wall-languages), shown in the room in whatever second
   * language its exhibition offers; it doesn't record a language (owner, 2026-11-14).
   */
  textContentSecond?: string
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
  soundIcon?: string // `Icon` name to display (see ui/Icon), stored: never rename a key
  soundPlayMode?: 'loop' | 'play-once' // Playback mode
  soundSpatial?: boolean // 3D spatial audio
  soundDistance?: number // Reference distance for spatial audio falloff
  soundBackgroundColor?: string | null // Background color of the sound object
  soundIconColor?: string // Icon color
  soundIconSize?: number // Icon size (px in 2D)
  // Video artwork settings (exhibition-level)
  videoUrl?: string // URL of the video file
  videoPlayMode?: 'proximity' | 'always' | 'click' // Playback mode
  videoLoop?: boolean // Whether video loops
  videoVolume?: number // Volume level 0-1
  videoProximityDistance?: number // Distance in meters to trigger playback
  // Shape decoration properties (only when artworkType = 'shape')
  shapeType?: string // 'rectangle' | 'circle'
  shapeColor?: string
  shapeOpacity?: number
}
