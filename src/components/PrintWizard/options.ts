import type {
  FormatOption,
  FrameColorOption,
  MountOption,
  Orientation,
  PaperOption,
  PrintConfig,
  PrintOptions,
  SizeId,
  SizeOption,
  SizeUnit,
} from './types'

// ── Papers ───────────────────────────────────────────────────
// Two tiers. Labels use the technical name + weight — that's what pros
// expect to see everywhere (wizard dropdown, artist restrictions, the
// Certificate of Authenticity). "Fine Art Matte" / "Museum Cotton Rag"
// as category blurbs live in the `description` instead.
export const PAPERS: PaperOption[] = [
  {
    id: 'fine-art-matte',
    label: 'Enhanced Matte Art 200 gsm',
    description:
      'Fine art matte paper, 200 gsm. Smooth satin finish with excellent color depth — our everyday fine-art standard.',
    prodigiUnframedPrefix: 'GLOBAL-FAP',
    prodigiFramedToken: 'EMA',
  },
  {
    id: 'museum-cotton-rag',
    label: 'Hahnemühle Photo Rag 308 gsm',
    description:
      '100% cotton, archival museum cotton rag. Smooth matte surface with deep blacks and accurate color — the collector choice for photography and fine-art reproduction.',
    prodigiUnframedPrefix: 'GLOBAL-HPR',
    prodigiFramedToken: 'HPR',
  },
  {
    id: 'german-etching',
    label: 'Hahnemühle German Etching 310 gsm',
    description:
      'Heavily textured mould-made fine-art paper with pronounced tooth and warm-white tone. Favoured for black-and-white and painterly work where surface character matters.',
    prodigiUnframedPrefix: 'GLOBAL-HGE',
    prodigiFramedToken: 'HGE',
  },
]

// ── Formats ──────────────────────────────────────────────────
export const FORMATS: FormatOption[] = [
  {
    id: 'unframed',
    label: 'Unframed print',
    description: 'Just the print, rolled or flat-packed.',
    framed: false,
  },
  {
    id: 'classic-framed',
    label: 'Classic frame',
    description: 'Flush wooden frame with Perspex glazing, ready to hang.',
    framed: true,
  },
  {
    id: 'box-framed',
    label: 'Box frame',
    description: 'Deeper wooden frame with the print recessed inside. Modern gallery look.',
    framed: true,
  },
]

// ── Frame colors ────────────────────────────────────────────
export const FRAME_COLORS: FrameColorOption[] = [
  { id: 'black', label: 'Black', prodigiColor: 'black', hex: '#0b0b0b', roughness: 0.35 },
  { id: 'white', label: 'White', prodigiColor: 'white', hex: '#f2f2f2', roughness: 0.55 },
  { id: 'oak', label: 'Natural oak', prodigiColor: 'natural', hex: '#c8a27a', roughness: 0.7 },
  { id: 'walnut', label: 'Walnut', prodigiColor: 'brown', hex: '#5a3b28', roughness: 0.7 },
]

// ── Mount options ────────────────────────────────────────────
export const MOUNTS: MountOption[] = [
  { id: 'none', label: 'No mount', prodigiToken: 'NM', prodigiMountColor: '', borderCm: 0 },
  {
    id: 'snow-white',
    label: 'With mount',
    prodigiToken: 'MOUNT1',
    prodigiMountColor: 'Snow white',
    borderCm: 5.0,
  },
]

// ── Sizes ────────────────────────────────────────────────────
// Each size carries both its cm token (for FRA-* SKUs) and inch token (for
// GLOBAL-* SKUs). Keeping the label dual-unit lets buyers orient themselves
// whichever market they're in.
export const SIZES: SizeOption[] = [
  {
    id: '20x25',
    widthCm: 20,
    heightCm: 25,
    cmToken: '20X25',
    inchToken: '8X10',
    label: '20×25 cm (8×10″)',
  },
  {
    id: '20x30',
    widthCm: 20,
    heightCm: 30,
    cmToken: '20X30',
    inchToken: '8X12',
    label: '20×30 cm (8×12″)',
  },
  {
    id: '28x36',
    widthCm: 28,
    heightCm: 36,
    cmToken: '28X36',
    inchToken: '11X14',
    label: '28×36 cm (11×14″)',
  },
  {
    id: '30x40',
    widthCm: 30,
    heightCm: 40,
    cmToken: '30X40',
    inchToken: '12X16',
    label: '30×40 cm (12×16″)',
  },
  {
    id: '40x50',
    widthCm: 40,
    heightCm: 50,
    cmToken: '40X50',
    inchToken: '16X20',
    label: '40×50 cm (16×20″)',
  },
  {
    id: '50x70',
    widthCm: 50,
    heightCm: 70,
    cmToken: '50X70',
    inchToken: '20X28',
    label: '50×70 cm (20×28″)',
  },
  {
    id: '60x80',
    widthCm: 60,
    heightCm: 80,
    cmToken: '60X80',
    inchToken: '24X32',
    label: '60×80 cm (24×32″)',
  },
]

// ── Catalog accessors ────────────────────────────────────────
function resolve<T extends { id: string }>(list: T[], id: string, kind: string): T {
  const found = list.find((x) => x.id === id)
  if (found) return found
  const fallback = list[0]
  if (!fallback) throw new Error(`[PrintWizard] Empty catalog for ${kind}`)
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[PrintWizard] Unknown ${kind} id "${id}" — falling back to "${fallback.id}"`)
  }
  return fallback
}

export const getPaper = (id: string) => resolve(PAPERS, id, 'paper')
export const getFormat = (id: string) => resolve(FORMATS, id, 'format')
export const getFrameColor = (id: string) => resolve(FRAME_COLORS, id, 'frame color')
export const getMount = (id: string) => resolve(MOUNTS, id, 'mount')
export const getSize = (id: string) => resolve(SIZES, id, 'size')

// ── Per-artwork restriction filters ──────────────────────────
// Each returns the input list unchanged when the artwork has no
// restriction for that dimension, or the allow-list intersected with
// the input when a non-empty list is set. An empty allow-list means
// "artist disallowed everything" — we treat that as no restriction
// (defense against artists accidentally locking out all buyers).

function filterByAllowlist<T extends { id: string }>(
  list: T[],
  allowed: readonly string[] | undefined,
): T[] {
  if (!allowed || allowed.length === 0) return list
  const set = new Set(allowed)
  const filtered = list.filter((item) => set.has(item.id))
  return filtered.length === 0 ? list : filtered
}

export function filterPapersForArtwork(opts: PrintOptions | null | undefined) {
  return filterByAllowlist(PAPERS, opts?.allowedPaperIds)
}

export function filterFormatsForArtwork(opts: PrintOptions | null | undefined) {
  return filterByAllowlist(FORMATS, opts?.allowedFormatIds)
}

export function filterSizesForArtwork(list: SizeOption[], opts: PrintOptions | null | undefined) {
  return filterByAllowlist(list, opts?.allowedSizeIds)
}

export function filterFrameColorsForArtwork(opts: PrintOptions | null | undefined) {
  return filterByAllowlist(FRAME_COLORS, opts?.allowedFrameColorIds)
}

export function filterMountsForArtwork(opts: PrintOptions | null | undefined) {
  return filterByAllowlist(MOUNTS, opts?.allowedMountIds)
}

/**
 * Server-side validation: is this chosen PrintConfig permitted by the
 * artwork's restrictions? Used at PaymentIntent creation time to defend
 * against a buyer who had the wizard open while the artist tightened
 * restrictions. Returns true when allowed, false when a chosen value
 * is no longer in the artist's allow-list.
 */
export function configRespectsArtworkRestrictions(
  config: PrintConfig,
  opts: PrintOptions | null | undefined,
): boolean {
  if (!opts) return true
  const inAllowlist = (allowed: readonly string[] | undefined, value: string) =>
    !allowed || allowed.length === 0 || allowed.includes(value)
  if (!inAllowlist(opts.allowedPaperIds, config.paperId)) return false
  if (!inAllowlist(opts.allowedFormatIds, config.formatId)) return false
  if (!inAllowlist(opts.allowedSizeIds, config.sizeId)) return false
  // Frame color + mount are only meaningful on framed formats, so we
  // only enforce them when the chosen format is framed.
  const format = FORMATS.find((f) => f.id === config.formatId)
  if (format?.framed) {
    if (!inAllowlist(opts.allowedFrameColorIds, config.frameColorId)) return false
    if (!inAllowlist(opts.allowedMountIds, config.mountId)) return false
  }
  return true
}

// ── Aspect-ratio size filter ─────────────────────────────────
// Tier 1 ≤ 2% off → "perfect". Tier 2 ≤ 5% off → "close fit". Beyond that
// we hide the size unless the UI explicitly asks for all.
export const RATIO_TOLERANCE_PERFECT = 0.02
export const RATIO_TOLERANCE_CLOSE = 0.05

export type SizeFit = 'perfect' | 'close' | 'mismatch'

export function getSizeFit(size: SizeOption, imageRatio: number): SizeFit {
  // Compare both orientations — a portrait image fits a portrait size natively;
  // we allow either orientation because Prodigi Classic Frame is
  // orientation-agnostic (the same SKU covers portrait & landscape).
  const sizeRatioA = size.widthCm / size.heightCm
  const sizeRatioB = size.heightCm / size.widthCm
  const diffA = Math.abs(sizeRatioA - imageRatio) / imageRatio
  const diffB = Math.abs(sizeRatioB - imageRatio) / imageRatio
  const diff = Math.min(diffA, diffB)
  if (diff <= RATIO_TOLERANCE_PERFECT) return 'perfect'
  if (diff <= RATIO_TOLERANCE_CLOSE) return 'close'
  return 'mismatch'
}

export function getCompatibleSizes(imageRatio: number): {
  perfect: SizeOption[]
  close: SizeOption[]
  mismatch: SizeOption[]
} {
  const perfect: SizeOption[] = []
  const close: SizeOption[] = []
  const mismatch: SizeOption[] = []
  for (const s of SIZES) {
    const fit = getSizeFit(s, imageRatio)
    if (fit === 'perfect') perfect.push(s)
    else if (fit === 'close') close.push(s)
    else mismatch.push(s)
  }
  return { perfect, close, mismatch }
}

// ── SKU derivation ───────────────────────────────────────────
// Resolves a PrintConfig to the concrete Prodigi SKU and the runtime
// attributes (color, mount color, paper type) that must be sent with
// the order.
//
// SKU families in play (verified against live Prodigi, Apr 2026):
//   - Unframed:                  GLOBAL-<PAPER_PREFIX>-<INCH_SIZE>
//   - Classic framed + EMA:      GLOBAL-CFP[M]-<INCH_SIZE>
//   - Classic framed + other:    FRA-CLA-<PAPER>-<MOUNT>-ACRY-<CM_SIZE>
//   - Box framed (any paper):    GLOBAL-BOX-<INCH_SIZE>  — paper, mount,
//                                glaze are variant ATTRIBUTES on this
//                                SKU family (not tokens in the SKU).
//                                Prodigi Box Frames ship with EMA 200gsm
//                                internally regardless of what the buyer
//                                saw in the wizard.
//
// Glazing is always Perspex (ACRY) by spec. Frame color and mount color
// are runtime attributes on the variant, not part of the SKU itself.
export type ResolvedSku = {
  sku: string
  attributes: Record<string, string>
}

export function resolveSku(config: PrintConfig): ResolvedSku {
  const paper = getPaper(config.paperId)
  const size = getSize(config.sizeId)
  const format = getFormat(config.formatId)
  const mount = getMount(config.mountId)
  const color = getFrameColor(config.frameColorId)

  // Unframed — inch-tokened, no runtime attributes beyond paper.
  if (!format.framed) {
    return {
      sku: `${paper.prodigiUnframedPrefix}-${size.inchToken}`,
      attributes: {},
    }
  }

  const attributes: Record<string, string> = { color: color.prodigiColor }
  if (mount.id !== 'none') attributes.mountColor = mount.prodigiMountColor

  // Classic framed + Fine Art Matte lives under the older GLOBAL-CFP family
  // (inch-tokened, no paper in the SKU).
  if (config.formatId === 'classic-framed' && paper.id === 'fine-art-matte') {
    const base = mount.id === 'none' ? 'GLOBAL-CFP' : 'GLOBAL-CFPM'
    return { sku: `${base}-${size.inchToken}`, attributes }
  }

  // Classic framed + Museum Cotton Rag → FRA-CLA family.
  if (config.formatId === 'classic-framed') {
    return {
      sku: `FRA-CLA-${paper.prodigiFramedToken}-${mount.prodigiToken}-ACRY-${size.cmToken}`,
      attributes,
    }
  }

  // Box framed → GLOBAL-BOX-<inch> family. This is a standalone Prodigi
  // product with paperType / substrateWeight / mount / glaze exposed as
  // variant attributes on the SKU rather than encoded in the SKU string.
  // We only pass `color` (frame color) explicitly; the order-submission
  // path in createPrintOrderFromPaymentIntent already fills missing
  // attributes from the first available value on the product response.
  return {
    sku: `GLOBAL-BOX-${size.inchToken}`,
    attributes,
  }
}

// ── Prodigi cost estimate (Phase A fallback) ─────────────────
// Rough per-SKU cost estimates in EUR cents, derived from our quote probes
// against production (shipping to ES). These are placeholders until we wire
// live quotes in Phase C.
//
// Indexed by (paperId, formatId, sizeId). Mount adds a small flat supplement.
const COST_TABLE: Record<string, Record<string, Partial<Record<SizeId, number>>>> = {
  'fine-art-matte': {
    unframed: {
      '20x25': 1100,
      '20x30': 1300,
      '28x36': 1900,
      '30x40': 2300,
      '40x50': 3500,
    },
    'classic-framed': {
      '30x40': 6100,
      '40x50': 8100,
      '50x70': 10600,
      '60x80': 12000,
    },
    'box-framed': {
      '30x40': 7500,
      '40x50': 8974,
      '50x70': 11500,
      '60x80': 13500,
    },
  },
  'museum-cotton-rag': {
    unframed: {
      '20x30': 2300,
      '28x36': 4300,
      '30x40': 5000,
      '40x50': 8000,
    },
    'classic-framed': {
      '30x40': 7593,
      '40x50': 10355,
      '50x70': 13461,
      '60x80': 14727,
    },
    'box-framed': {
      '30x40': 8700,
      '40x50': 11600,
      '50x70': 14500,
      '60x80': 16000,
    },
  },
}

/** Mount adds ~€10 supplement across the board (from our quote data). */
const MOUNT_SUPPLEMENT_CENTS = 1000

/**
 * Estimated Prodigi base cost (ex-shipping) in EUR cents for the given
 * config. Returns null if the combination has no known cost — the UI
 * should disable unavailable options rather than guess.
 */
export function estimateProdigiCostCents(config: PrintConfig): number | null {
  const paperTable = COST_TABLE[config.paperId]
  if (!paperTable) return null
  const formatTable = paperTable[config.formatId]
  if (!formatTable) return null
  const base = formatTable[config.sizeId]
  if (base == null) return null
  const format = getFormat(config.formatId)
  const mountExtra = format.framed && config.mountId !== 'none' ? MOUNT_SUPPLEMENT_CENTS : 0
  return base + mountExtra
}

// ── Pricing ──────────────────────────────────────────────────
// Customer-facing price = Prodigi cost + artist price + gallery cut + VAT.
// Gallery cut is a percentage of the artist price (30–45%). For MVP we use
// a single flat markup; can be per-artist later.

export const GALLERY_MARKUP_RATE = 0.45 // 45% of artist price
export const VAT_RATE = 0.21 // Spain standard

export type PriceBreakdown = {
  prodigiCostCents: number
  artistPriceCents: number
  galleryCutCents: number
  subtotalCents: number
  vatCents: number
  totalCents: number
  /** True when one or more components couldn't be computed. */
  partial: boolean
}

export function computePrice(
  config: PrintConfig,
  opts: { printPriceCents: number; vatRate?: number },
): PriceBreakdown {
  const prodigi = estimateProdigiCostCents(config) ?? 0
  const artist = opts.printPriceCents
  const gallery = Math.round(artist * GALLERY_MARKUP_RATE)
  const subtotal = prodigi + artist + gallery
  const vatRate = opts.vatRate ?? VAT_RATE
  const vat = Math.round(subtotal * vatRate)
  const total = subtotal + vat
  return {
    prodigiCostCents: prodigi,
    artistPriceCents: artist,
    galleryCutCents: gallery,
    subtotalCents: subtotal,
    vatCents: vat,
    totalCents: total,
    partial: estimateProdigiCostCents(config) == null,
  }
}

// ── Formatters ───────────────────────────────────────────────
export const CM_PER_INCH = 2.54

export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH
}

export function formatEuro(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

export function formatSize(size: SizeOption, unit: SizeUnit, orientation?: Orientation): string {
  // SIZES are stored portrait (height >= width). Landscape orientation swaps
  // the two so the label matches how the print will actually hang.
  const isLandscape = orientation === 'landscape'
  const wCm = isLandscape ? size.heightCm : size.widthCm
  const hCm = isLandscape ? size.widthCm : size.heightCm
  if (unit === 'inches') {
    const w = cmToInches(wCm).toFixed(1)
    const h = cmToInches(hCm).toFixed(1)
    return `${w}″ × ${h}″`
  }
  return `${wCm} × ${hCm} cm`
}

/** Portrait when the image is taller than wide; landscape otherwise. Square → landscape. */
export function deriveOrientation(aspectRatio: number): Orientation {
  return aspectRatio < 1 ? 'portrait' : 'landscape'
}

// ── Default + normalization ──────────────────────────────────
export function buildDefaultConfig(
  originalWidthPx?: number,
  originalHeightPx?: number,
): PrintConfig {
  // Pick the best-fitting 30×40 if the artwork's aspect ratio matches;
  // otherwise fall back to the first perfect-fit size, then first close-fit,
  // then 30×40 unconditionally.
  let preferredSizeId: SizeId = '30x40'
  let orientation: Orientation = 'portrait'
  if (originalWidthPx && originalHeightPx) {
    const ratio = originalWidthPx / originalHeightPx
    const fits = getCompatibleSizes(ratio)
    const pick = fits.perfect[0] ?? fits.close[0]
    if (pick) preferredSizeId = pick.id
    orientation = deriveOrientation(ratio)
  }
  return normalizePrintConfig({
    paperId: 'museum-cotton-rag',
    formatId: 'classic-framed',
    sizeId: preferredSizeId,
    frameColorId: 'oak',
    mountId: 'snow-white',
    unit: 'cm',
    orientation,
  })
}

// ── Availability helpers (client-side catalog filtering) ─────
// These take a pre-fetched catalog (see getPrintCatalog) and answer
// "does this config/option ship to this country?" without hitting Prodigi.

type SkuDataLite = {
  sku: string
  variants: Array<{ attributes: Record<string, string>; shipsTo: string[] }>
}

/** The union of every country any SKU in the catalog ships to. */
export function collectAllCountries(catalog: SkuDataLite[]): string[] {
  const set = new Set<string>()
  for (const data of catalog) {
    for (const v of data.variants) {
      for (const c of v.shipsTo) set.add(c)
    }
  }
  return Array.from(set).sort()
}

/** True if this exact config's SKU+variant ships to `country`. */
export function configShipsTo(
  config: PrintConfig,
  country: string,
  catalog: SkuDataLite[],
): boolean {
  const { sku, attributes } = resolveSku(config)
  const data = catalog.find((s) => s.sku === sku)
  if (!data) return false
  const matching = data.variants.filter((v) =>
    Object.entries(attributes).every(([k, val]) => v.attributes[k] === val),
  )
  const pool = matching.length > 0 ? matching : data.variants
  return pool.some((v) => v.shipsTo.includes(country))
}

/**
 * Would swapping one dimension of `current` to `value` yield a config that
 * ships to `country`? Used to filter option values per dimension based on
 * the user's other picks + chosen destination.
 */
export function canSwap(
  current: PrintConfig,
  dimension: 'paper' | 'format' | 'size' | 'frame' | 'mount',
  value: string,
  country: string,
  catalog: SkuDataLite[],
): boolean {
  const key: keyof PrintConfig = {
    paper: 'paperId',
    format: 'formatId',
    size: 'sizeId',
    frame: 'frameColorId',
    mount: 'mountId',
  }[dimension] as keyof PrintConfig
  const swapped = normalizePrintConfig({ ...current, [key]: value })
  return configShipsTo(swapped, country, catalog)
}

/**
 * First shippable-to-`country` config found by iterating the option
 * arrays in their declared order. No hardcoded preferences — whatever
 * the catalog actually has for that country wins, so we never seed the
 * UI with a specific paper/frame/size that might not even exist.
 *
 * Size iteration respects the artwork's aspect ratio (perfect fits
 * first) so the user doesn't land on a visibly wrong shape.
 *
 * `printOptions` narrows the search to artist-allowed values — we never
 * auto-pick a banned paper/size/format to satisfy shipping. If the
 * intersection of (shippable) and (artist-allowed) is empty, returns
 * null so the wizard can show an "unavailable for this destination"
 * message rather than silently drifting into a config that'll get
 * rejected server-side.
 */
export function firstShippableConfig(
  country: string,
  catalog: SkuDataLite[],
  aspectRatio: number,
  printOptions?: PrintOptions | null,
): PrintConfig | null {
  const groups = getCompatibleSizes(aspectRatio)
  const sizes = [...groups.perfect, ...groups.close, ...groups.mismatch]

  const allowedPapers = filterPapersForArtwork(printOptions)
  const allowedFormats = filterFormatsForArtwork(printOptions)
  const allowedSizes = filterSizesForArtwork(sizes, printOptions)
  const allowedFrames = filterFrameColorsForArtwork(printOptions)
  const allowedMounts = filterMountsForArtwork(printOptions)

  const orientation = deriveOrientation(aspectRatio)
  for (const paper of allowedPapers) {
    for (const format of allowedFormats) {
      for (const size of allowedSizes) {
        for (const frame of allowedFrames) {
          for (const mount of allowedMounts) {
            const c: PrintConfig = {
              paperId: paper.id,
              formatId: format.id,
              sizeId: size.id,
              frameColorId: frame.id,
              mountId: format.framed ? mount.id : 'none',
              unit: 'cm',
              orientation,
            }
            if (configShipsTo(c, country, catalog)) return c
          }
        }
      }
    }
  }
  return null
}

/**
 * Returns the shippable-to-`country` config closest to `preferred` — i.e.
 * the one that differs in the fewest dimensions. Used to gracefully snap
 * the user's selection when they change country and their previous picks
 * are no longer available (so dropdowns never show a selected value that
 * isn't actually in their filtered option list).
 *
 * Ties are broken by preferring to change, in order: frame color, mount,
 * size (fit-grouped), format, paper — i.e. we try to keep the structural
 * decisions and adjust the superficial ones first.
 *
 * `printOptions` restricts the search to artist-allowed values so we
 * never silently drift into a paper/format/size the artist banned for
 * this artwork. If no combination satisfies both shipping AND
 * restrictions, returns null — the wizard treats that as "unavailable
 * for this destination".
 */
export function findShippableConfig(
  preferred: PrintConfig,
  country: string,
  catalog: SkuDataLite[],
  aspectRatio: number,
  printOptions?: PrintOptions | null,
): PrintConfig | null {
  const groups = getCompatibleSizes(aspectRatio)
  const sizes = [...groups.perfect, ...groups.close, ...groups.mismatch]

  const allowedPapers = filterPapersForArtwork(printOptions)
  const allowedFormats = filterFormatsForArtwork(printOptions)
  const allowedSizes = filterSizesForArtwork(sizes, printOptions)
  const allowedFrames = filterFrameColorsForArtwork(printOptions)
  const allowedMounts = filterMountsForArtwork(printOptions)

  const DIM_WEIGHT = { paper: 16, format: 8, size: 4, mount: 2, frame: 1 }

  let best: { config: PrintConfig; cost: number } | null = null

  for (const paper of allowedPapers) {
    for (const format of allowedFormats) {
      for (const size of allowedSizes) {
        for (const frame of allowedFrames) {
          for (const mount of allowedMounts) {
            const c: PrintConfig = {
              paperId: paper.id,
              formatId: format.id,
              sizeId: size.id,
              frameColorId: frame.id,
              mountId: format.framed ? mount.id : 'none',
              unit: preferred.unit,
              orientation: preferred.orientation,
            }
            if (!configShipsTo(c, country, catalog)) continue
            const cost =
              (c.paperId !== preferred.paperId ? DIM_WEIGHT.paper : 0) +
              (c.formatId !== preferred.formatId ? DIM_WEIGHT.format : 0) +
              (c.sizeId !== preferred.sizeId ? DIM_WEIGHT.size : 0) +
              (c.mountId !== preferred.mountId ? DIM_WEIGHT.mount : 0) +
              (c.frameColorId !== preferred.frameColorId ? DIM_WEIGHT.frame : 0)
            if (!best || cost < best.cost) best = { config: c, cost }
          }
        }
      }
    }
  }
  return best?.config ?? null
}

/**
 * Every distinct Prodigi SKU the wizard can possibly produce. Used by the
 * catalog pre-fetch on wizard mount so we can filter option availability
 * per destination country without additional API calls.
 *
 * Frame color and mount *color* are variant attributes inside a SKU's
 * product response, not part of the SKU itself — so enumerating them is
 * unnecessary. We iterate paper × format × size × mount, take the SKU from
 * resolveSku(), and dedupe.
 */
export function enumerateSkus(): string[] {
  const set = new Set<string>()
  for (const paper of PAPERS) {
    for (const format of FORMATS) {
      for (const size of SIZES) {
        if (!format.framed) {
          // Unframed: mount/frame not used
          const { sku } = resolveSku({
            paperId: paper.id,
            formatId: format.id,
            sizeId: size.id,
            frameColorId: FRAME_COLORS[0].id,
            mountId: 'none',
            unit: 'cm',
            orientation: 'portrait',
          })
          set.add(sku)
          continue
        }
        for (const mount of MOUNTS) {
          const { sku } = resolveSku({
            paperId: paper.id,
            formatId: format.id,
            sizeId: size.id,
            frameColorId: FRAME_COLORS[0].id,
            mountId: mount.id,
            unit: 'cm',
            orientation: 'portrait',
          })
          set.add(sku)
        }
      }
    }
  }
  return Array.from(set)
}

/**
 * Repair any stale/invalid ids in a PrintConfig. Safe to call after every
 * state change — cheap and catches catalog drift without throwing.
 */
export function normalizePrintConfig(config: PrintConfig): PrintConfig {
  const paperId = PAPERS.find((p) => p.id === config.paperId)?.id ?? PAPERS[0].id
  const formatId = FORMATS.find((f) => f.id === config.formatId)?.id ?? FORMATS[0].id
  const sizeId = SIZES.find((s) => s.id === config.sizeId)?.id ?? SIZES[3].id // 30x40 default
  const frameColorId =
    FRAME_COLORS.find((c) => c.id === config.frameColorId)?.id ?? FRAME_COLORS[0].id
  const mountId = MOUNTS.find((m) => m.id === config.mountId)?.id ?? MOUNTS[0].id
  const unit: SizeUnit = config.unit === 'inches' ? 'inches' : 'cm'
  const orientation: Orientation = config.orientation === 'landscape' ? 'landscape' : 'portrait'
  return { paperId, formatId, sizeId, frameColorId, mountId, unit, orientation }
}
