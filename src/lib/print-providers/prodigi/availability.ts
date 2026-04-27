/**
 * Prodigi-specific availability logic. Operates on a fetched
 * ProdigiSkuData[] (the live SKU/variant catalog from Prodigi) — answers
 * "does this config ship to this country?" client-side without
 * additional API calls.
 *
 * Used by the adapter's `buildAvailability` implementation to expose a
 * provider-agnostic predicate up to the wizard.
 */
import {
  configToProdigi,
  normalizeProdigiConfig,
  type PrintOptions,
  type ProdigiConfig,
} from './config'
import {
  CM_PER_INCH,
  PRODIGI_MIN_PRINT_DPI,
  PRODIGI_FORMATS,
  PRODIGI_FRAME_COLORS,
  PRODIGI_MOUNTS,
  PRODIGI_PAPERS,
  PRODIGI_SIZES,
  type ProdigiSize,
} from './data'
import type { ProdigiSkuData } from './loadCatalog'
import { resolveProdigiSku } from './resolveSku'
import type { WizardConfig } from '../types'

export function collectAllCountries(catalog: ProdigiSkuData[]): string[] {
  const set = new Set<string>()
  for (const data of catalog) {
    for (const v of data.variants) {
      for (const c of v.shipsTo) set.add(c)
    }
  }
  return Array.from(set).sort()
}

export function configShipsTo(
  config: ProdigiConfig,
  country: string,
  catalog: ProdigiSkuData[],
): boolean {
  const { sku, attributes } = resolveProdigiSku(config)
  const data = catalog.find((s) => s.sku === sku)
  if (!data) return false
  const matching = data.variants.filter((v) =>
    Object.entries(attributes).every(([k, val]) => v.attributes[k] === val),
  )
  const pool = matching.length > 0 ? matching : data.variants
  return pool.some((v) => v.shipsTo.includes(country))
}

const DIM_KEY: Record<string, keyof ProdigiConfig> = {
  paper: 'paperId',
  format: 'formatId',
  size: 'sizeId',
  color: 'frameColorId',
  mount: 'mountId',
  orientation: 'orientation',
}

/** True if swapping `dimensionId → optionId` keeps the config shippable. */
export function canSwap(
  current: ProdigiConfig,
  dimensionId: string,
  value: string,
  country: string,
  catalog: ProdigiSkuData[],
): boolean {
  if (dimensionId === 'orientation') return true
  const key = DIM_KEY[dimensionId]
  if (!key) return true
  const swapped = normalizeProdigiConfig({ ...current, [key]: value } as ProdigiConfig)
  return configShipsTo(swapped, country, catalog)
}

// ── Aspect-ratio fit ─────────────────────────────────────────────

export const RATIO_TOLERANCE_PERFECT = 0.02
export const RATIO_TOLERANCE_CLOSE = 0.05

export type SizeFit = 'perfect' | 'close' | 'mismatch'

export function getSizeFit(size: ProdigiSize, imageRatio: number): SizeFit {
  const sizeRatioA = size.widthCm / size.heightCm
  const sizeRatioB = size.heightCm / size.widthCm
  const diffA = Math.abs(sizeRatioA - imageRatio) / imageRatio
  const diffB = Math.abs(sizeRatioB - imageRatio) / imageRatio
  const diff = Math.min(diffA, diffB)
  if (diff <= RATIO_TOLERANCE_PERFECT) return 'perfect'
  if (diff <= RATIO_TOLERANCE_CLOSE) return 'close'
  return 'mismatch'
}

export function isSizePrintEligible(size: ProdigiSize, widthPx: number, heightPx: number): boolean {
  if (widthPx <= 0 || heightPx <= 0) return true
  const requiredW = Math.ceil((size.widthCm / CM_PER_INCH) * PRODIGI_MIN_PRINT_DPI)
  const requiredH = Math.ceil((size.heightCm / CM_PER_INCH) * PRODIGI_MIN_PRINT_DPI)
  const fitsPortrait = widthPx >= requiredW && heightPx >= requiredH
  const fitsLandscape = widthPx >= requiredH && heightPx >= requiredW
  return fitsPortrait || fitsLandscape
}

// ── Per-artwork restrictions ─────────────────────────────────────

function inAllowlist(allowed: readonly string[] | undefined, value: string): boolean {
  return !allowed || allowed.length === 0 || allowed.includes(value)
}

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
  return filterByAllowlist(PRODIGI_PAPERS, opts?.allowedPaperIds)
}

export function filterFormatsForArtwork(opts: PrintOptions | null | undefined) {
  return filterByAllowlist(PRODIGI_FORMATS, opts?.allowedFormatIds)
}

export function filterSizesForArtwork(list: ProdigiSize[], opts: PrintOptions | null | undefined) {
  return filterByAllowlist(list, opts?.allowedSizeIds)
}

export function filterFrameColorsForArtwork(opts: PrintOptions | null | undefined) {
  return filterByAllowlist(PRODIGI_FRAME_COLORS, opts?.allowedFrameColorIds)
}

export function filterMountsForArtwork(opts: PrintOptions | null | undefined) {
  return filterByAllowlist(PRODIGI_MOUNTS, opts?.allowedMountIds)
}

/**
 * Server-side validation: does this config respect the artwork's
 * restrictions? Used at PaymentIntent creation time.
 */
export function configRespectsArtworkRestrictions(
  config: WizardConfig | ProdigiConfig,
  opts: PrintOptions | null | undefined,
): boolean {
  if (!opts) return true
  const prodigi: ProdigiConfig = 'values' in config ? configToProdigi(config) : config
  if (!inAllowlist(opts.allowedPaperIds, prodigi.paperId)) return false
  if (!inAllowlist(opts.allowedFormatIds, prodigi.formatId)) return false
  if (!inAllowlist(opts.allowedSizeIds, prodigi.sizeId)) return false
  const format = PRODIGI_FORMATS.find((f) => f.id === prodigi.formatId)
  if (format?.framed) {
    if (!inAllowlist(opts.allowedFrameColorIds, prodigi.frameColorId)) return false
    if (!inAllowlist(opts.allowedMountIds, prodigi.mountId)) return false
  }
  return true
}

// ── Initial / fallback configs ───────────────────────────────────

function getCompatibleSizes(imageRatio: number): {
  perfect: ProdigiSize[]
  close: ProdigiSize[]
  mismatch: ProdigiSize[]
} {
  const perfect: ProdigiSize[] = []
  const close: ProdigiSize[] = []
  const mismatch: ProdigiSize[] = []
  for (const s of PRODIGI_SIZES) {
    const fit = getSizeFit(s, imageRatio)
    if (fit === 'perfect') perfect.push(s)
    else if (fit === 'close') close.push(s)
    else mismatch.push(s)
  }
  return { perfect, close, mismatch }
}

export { getCompatibleSizes }

export function buildDefaultProdigiConfig(
  originalWidthPx?: number,
  originalHeightPx?: number,
): ProdigiConfig {
  let preferredSizeId: ProdigiConfig['sizeId'] = '60x80'
  let orientation: ProdigiConfig['orientation'] = 'portrait'
  if (originalWidthPx && originalHeightPx) {
    const ratio = originalWidthPx / originalHeightPx
    const fits = getCompatibleSizes(ratio)
    const pick = fits.perfect[fits.perfect.length - 1] ?? fits.close[fits.close.length - 1]
    if (pick) preferredSizeId = pick.id
    orientation = ratio < 1 ? 'portrait' : 'landscape'
  }
  return normalizeProdigiConfig({
    paperId: 'museum-cotton-rag',
    formatId: 'classic-framed',
    sizeId: preferredSizeId,
    frameColorId: 'black',
    mountId: 'snow-white',
    orientation,
  })
}

export function firstShippableProdigiConfig(
  country: string,
  catalog: ProdigiSkuData[],
  aspectRatio: number,
  opts?: PrintOptions | null,
): ProdigiConfig | null {
  const groups = getCompatibleSizes(aspectRatio)
  const sizes = [
    ...groups.perfect.slice().reverse(),
    ...groups.close.slice().reverse(),
    ...groups.mismatch.slice().reverse(),
  ]

  const allowedPapers = filterPapersForArtwork(opts)
  const allowedFormats = filterFormatsForArtwork(opts)
  const allowedSizes = filterSizesForArtwork(sizes, opts)
  const allowedFrames = filterFrameColorsForArtwork(opts)
  const allowedMounts = filterMountsForArtwork(opts)

  const orderedFormats = [...allowedFormats].sort((a, b) => Number(b.framed) - Number(a.framed))
  const orientation: ProdigiConfig['orientation'] = aspectRatio < 1 ? 'portrait' : 'landscape'

  for (const paper of allowedPapers) {
    for (const format of orderedFormats) {
      for (const size of allowedSizes) {
        for (const frame of allowedFrames) {
          for (const mount of allowedMounts) {
            const c: ProdigiConfig = {
              paperId: paper.id,
              formatId: format.id,
              sizeId: size.id,
              frameColorId: frame.id,
              mountId: format.framed ? mount.id : 'none',
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
 * Convert the Prodigi-typed `PrintOptions` (stored on the artwork) into
 * the canonical `PrintRestrictions` the wizard consumes. The wizard
 * works against generic dimension ids; this maps Prodigi's typed
 * field names onto them.
 */
export function prodigiToWizardRestrictions(
  opts: PrintOptions | null | undefined,
): import('../types').PrintRestrictions {
  if (!opts) return { allowed: {} }
  const allowed: Record<string, string[]> = {}
  if (opts.allowedPaperIds?.length) allowed.paper = opts.allowedPaperIds
  if (opts.allowedFormatIds?.length) allowed.format = opts.allowedFormatIds
  if (opts.allowedSizeIds?.length) allowed.size = opts.allowedSizeIds
  if (opts.allowedFrameColorIds?.length) allowed.color = opts.allowedFrameColorIds
  if (opts.allowedMountIds?.length) allowed.mount = opts.allowedMountIds
  return { allowed }
}

export function findShippableProdigiConfig(
  preferred: ProdigiConfig,
  country: string,
  catalog: ProdigiSkuData[],
  aspectRatio: number,
  opts?: PrintOptions | null,
): ProdigiConfig | null {
  const groups = getCompatibleSizes(aspectRatio)
  const sizes = [...groups.perfect, ...groups.close, ...groups.mismatch]

  const allowedPapers = filterPapersForArtwork(opts)
  const allowedFormats = filterFormatsForArtwork(opts)
  const allowedSizes = filterSizesForArtwork(sizes, opts)
  const allowedFrames = filterFrameColorsForArtwork(opts)
  const allowedMounts = filterMountsForArtwork(opts)

  const DIM_WEIGHT = { paper: 16, format: 8, size: 4, mount: 2, frame: 1 }

  let best: { config: ProdigiConfig; cost: number } | null = null

  for (const paper of allowedPapers) {
    for (const format of allowedFormats) {
      for (const size of allowedSizes) {
        for (const frame of allowedFrames) {
          for (const mount of allowedMounts) {
            const c: ProdigiConfig = {
              paperId: paper.id,
              formatId: format.id,
              sizeId: size.id,
              frameColorId: frame.id,
              mountId: format.framed ? mount.id : 'none',
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
