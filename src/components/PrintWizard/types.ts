/**
 * Backward-compat shim. The original wizard types have moved into the
 * Prodigi adapter (`src/lib/print-providers/prodigi/`). External
 * consumers (admin, checkout, payment, artist UI, API routes) still
 * import from this path, so we re-export the typed Prodigi shapes
 * under their original names.
 *
 * The wizard internals NO LONGER import from this file — they consume
 * the canonical, provider-agnostic types from
 * `@/lib/print-providers/types` instead.
 */
import type { ProdigiConfig } from '@/lib/print-providers/prodigi'

export type {
  PaperId,
  FormatId,
  FrameColorId,
  MountId,
  SizeId,
  Orientation,
  ProdigiConfig,
  PrintOptions,
} from '@/lib/print-providers/prodigi'

export type {
  ProdigiPaper as PaperOption,
  ProdigiFormat as FormatOption,
  ProdigiFrameColor as FrameColorOption,
  ProdigiMount as MountOption,
  ProdigiSize as SizeOption,
} from '@/lib/print-providers/prodigi'

/** The strongly-typed Prodigi config — what every existing external consumer expects. */
export type PrintConfig = ProdigiConfig

/**
 * Preserved as-is. Used by the print page route + wizard props for the
 * artwork details. Provider-agnostic in shape.
 */
export type WizardArtwork = {
  slug: string
  title: string
  artistName: string
  year?: string
  imageUrl: string
  originalWidthPx: number
  originalHeightPx: number
  printPriceCents: number
  printOptions?: import('@/lib/print-providers/prodigi').PrintOptions | null
}
