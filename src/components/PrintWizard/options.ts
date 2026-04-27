/**
 * Backward-compat shim. The original wizard options module has moved
 * into the Prodigi adapter (`src/lib/print-providers/prodigi/`).
 * External consumers (admin, checkout, payment, artist UI, API routes)
 * still import from this path; the re-exports below preserve every
 * symbol they were using.
 *
 * The wizard internals NO LONGER import from this file. They use the
 * canonical, provider-agnostic surface at
 * `@/lib/print-providers`.
 */
export {
  // Prodigi option arrays (still consumed by the artist restrictions UI)
  PRODIGI_PAPERS as PAPERS,
  PRODIGI_FORMATS as FORMATS,
  PRODIGI_FRAME_COLORS as FRAME_COLORS,
  PRODIGI_MOUNTS as MOUNTS,
  PRODIGI_SIZES as SIZES,
  // Lookups
  getProdigiPaper as getPaper,
  getProdigiFormat as getFormat,
  getProdigiFrameColor as getFrameColor,
  getProdigiMount as getMount,
  getProdigiSize as getSize,
  // Config helpers (Prodigi-typed)
  buildDefaultProdigiConfig as buildDefaultConfig,
  normalizeProdigiConfig as normalizePrintConfig,
  deriveOrientation,
  // Per-artwork restrictions (typed Prodigi shape)
  configRespectsArtworkRestrictions,
  filterPapersForArtwork,
  filterFormatsForArtwork,
  filterSizesForArtwork,
  filterFrameColorsForArtwork,
  filterMountsForArtwork,
  // Aspect-ratio + DPI fit
  RATIO_TOLERANCE_CLOSE,
  RATIO_TOLERANCE_PERFECT,
  getCompatibleSizes,
  getSizeFit,
  isSizePrintEligible,
  // SKU
  resolveProdigiSku as resolveSku,
  enumerateProdigiSkus as enumerateSkus,
  // Availability over a fetched Prodigi catalog
  collectAllCountries,
  configShipsTo,
  canSwap,
  firstShippableProdigiConfig as firstShippableConfig,
  findShippableProdigiConfig as findShippableConfig,
  // Pricing (Prodigi-flavoured legacy helpers)
  COST_TABLE,
  EU_COUNTRY_CODES,
  GALLERY_MARKUP_RATE,
  MOUNT_SUPPLEMENT_CENTS,
  VAT_RATE,
  computePrice,
  computeQuotedTotals,
  estimateProdigiCostCents,
  formatSize,
} from '@/lib/print-providers/prodigi'

export type { ResolvedSku, PriceBreakdown, QuotedTotals } from '@/lib/print-providers/prodigi'

// Generic formatters (provider-agnostic).
export { CM_PER_INCH } from '@/lib/print-providers/prodigi'
export { cmToInches, formatDualDimensions, formatEuro } from '@/lib/print-providers/format'

// SizeFit type (used by the size grouping in checkout/payment UIs).
export type SizeFit = 'perfect' | 'close' | 'mismatch'
