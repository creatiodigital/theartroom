import {
  getPrintMaxSize,
  getPrintMinSize,
  type PrintSize,
} from '@/lib/print-providers/printspace/sizeBounds'
import { formatDimensions, formatDimensionsRange, type Unit } from '@/lib/units/format'

/**
 * The size line of an artwork, worked out — never typed (owner, 2026-11-17: every work is a print;
 * the artist's free-text "Dimensions" is no longer shown).
 *
 * - `range`: what the file prints at, smallest to largest (open editions, and Inquire-only works,
 *   which are treated as open editions).
 * - `fixed`: a limited edition's live variants, one print size each.
 *
 * Plain data so the server can work it out and the client write it in the visitor's unit.
 */
export type ArtworkSizes =
  | { kind: 'range'; min: PrintSize; max: PrintSize }
  | { kind: 'fixed'; sizes: PrintSize[] }

type ArtworkSizesInput = {
  editionType: string
  originalWidth: number | null
  originalHeight: number | null
  /** The LIVE variants only (`LIVE_VARIANT_WHERE`): their print size, not the sheet. */
  variants: { widthCm: number; heightCm: number }[]
}

/**
 * A limited edition with at least one live variant → its sizes, each once (two variants on
 * different papers can share a size), smallest first. Anything else → the file's range. Null when
 * there is no size to state: no pixel dimensions, or a file too small for the smallest print.
 */
export function getArtworkSizes({
  editionType,
  originalWidth,
  originalHeight,
  variants,
}: ArtworkSizesInput): ArtworkSizes | null {
  if (editionType === 'limited' && variants.length > 0) {
    const byText = new Map<string, PrintSize>()
    for (const { widthCm, heightCm } of variants) {
      const key = formatDimensions(widthCm, heightCm, 'cm')
      if (!byText.has(key)) byText.set(key, { widthCm, heightCm })
    }
    const sizes = [...byText.values()].sort((a, b) => a.widthCm * a.heightCm - b.widthCm * b.heightCm)
    return { kind: 'fixed', sizes }
  }

  if (!originalWidth || !originalHeight) return null
  const meta = { width: originalWidth, height: originalHeight }
  const min = getPrintMinSize(meta)
  const max = getPrintMaxSize(meta)
  return min && max ? { kind: 'range', min, max } : null
}

/** The size line(s) as written on the page: one for a range, one per size for a limited edition. */
export function artworkSizeLines(sizes: ArtworkSizes | null | undefined, unit: Unit): string[] {
  if (!sizes) return []
  if (sizes.kind === 'range') return [formatDimensionsRange(sizes.min, sizes.max, unit)]
  return sizes.sizes.map((size) => formatDimensions(size.widthCm, size.heightCm, unit))
}
