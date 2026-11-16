import { LIGHTBOX_EDGE_CM, isLightbox, readLightbox } from '@/lib/lightbox'

/**
 * Wall view scaling factor: pixels per meter.
 *
 * This value determines how many CSS pixels correspond to 1 meter
 * of wall space. It is used consistently throughout all 2D ↔ 3D
 * conversion logic, position calculations, and measurement displays.
 *
 * At WALL_SCALE = 400, a 5 m wall renders at 2000 px (comfortable
 * at 100 % browser zoom). Users can zoom out to ~10 % for a full
 * overview or zoom in to ~200 % for fine-grained work.
 */
export const WALL_SCALE = 400

type BorderedArtwork = {
  artworkType?: string | null
  showFrame?: boolean
  imageUrl?: string | null
  frameSize?: { value: number } | null
  showPassepartout?: boolean
  passepartoutSize?: { value: number } | null
  showPaperBorder?: boolean
  paperBorderSize?: { value: number } | null
  showLightbox?: boolean
  lightboxEdge?: string
}

/**
 * How far (cm) an artwork's look reaches past its image on each side: a lightbox's edge (AR-183:
 * frame, passepartout and paper border are off while it is on), else frame + passepartout + paper
 * border. Only an image has any.
 */
export const getArtworkBorderCm = (artwork: BorderedArtwork | null | undefined): number => {
  if (!artwork?.imageUrl) return 0
  if (isLightbox(artwork)) return LIGHTBOX_EDGE_CM[readLightbox(artwork).lightboxEdge]
  const frame = artwork.showFrame ? (artwork.frameSize?.value ?? 0) : 0
  const passepartout = artwork.showPassepartout ? (artwork.passepartoutSize?.value ?? 0) : 0
  const paper = artwork.showPaperBorder ? (artwork.paperBorderSize?.value ?? 0) : 0
  return frame + passepartout + paper
}

/**
 * Calculate total frame + passepartout + paper border width (or a lightbox's edge, AR-183) in 2D
 * pixels for a given artwork. Used by alignment, snapping, and grouping to account for the visual
 * extent of the artwork beyond its image area.
 */
export const getArtworkBorderPx = (artwork: BorderedArtwork | null | undefined): number =>
  getArtworkBorderCm(artwork) * (WALL_SCALE / 100)
