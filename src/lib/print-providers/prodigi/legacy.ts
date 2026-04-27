/**
 * Backward-compat helpers preserved as Prodigi-specific exports so the
 * existing PrintWizard/options.ts shim can re-export them without
 * forcing churn across ~15 downstream files.
 *
 * New code should prefer the canonical wizard types + the
 * `getProdigiQuote` server action — the helpers below are kept only
 * because checkout, payment, and admin still consume them directly.
 */
import type { Orientation, ProdigiConfig } from './config'
import {
  PRODIGI_COST_TABLE,
  PRODIGI_EU_COUNTRIES,
  PRODIGI_GALLERY_MARKUP_RATE,
  PRODIGI_MOUNT_SUPPLEMENT_CENTS,
  PRODIGI_VAT_RATE,
} from './data'
import { getProdigiFormat, getProdigiSize } from './config'
import { formatDualDimensions } from '../format'

export const VAT_RATE = PRODIGI_VAT_RATE
export const GALLERY_MARKUP_RATE = PRODIGI_GALLERY_MARKUP_RATE
export const EU_COUNTRY_CODES = PRODIGI_EU_COUNTRIES
export const MOUNT_SUPPLEMENT_CENTS = PRODIGI_MOUNT_SUPPLEMENT_CENTS
export const COST_TABLE = PRODIGI_COST_TABLE

export function estimateProdigiCostCents(config: ProdigiConfig): number | null {
  const paperTable = PRODIGI_COST_TABLE[config.paperId]
  if (!paperTable) return null
  const formatTable = paperTable[config.formatId]
  if (!formatTable) return null
  const base = formatTable[config.sizeId]
  if (base == null) return null
  const format = getProdigiFormat(config.formatId)
  const mountExtra = format.framed && config.mountId !== 'none' ? PRODIGI_MOUNT_SUPPLEMENT_CENTS : 0
  return base + mountExtra
}

export type QuotedTotals = {
  artistCents: number
  galleryCents: number
  prodigiItemCents: number
  prodigiShippingCents: number
  preTaxCents: number
  customerVatCents: number
  totalCents: number
}

export function computeQuotedTotals(opts: {
  printPriceCents: number
  prodigiItemCents: number
  prodigiShippingCents: number
  countryCode: string
}): QuotedTotals {
  const artistCents = opts.printPriceCents
  const galleryCents = Math.round(artistCents * PRODIGI_GALLERY_MARKUP_RATE)
  const preTaxCents = artistCents + galleryCents + opts.prodigiItemCents + opts.prodigiShippingCents
  const customerVatCents = PRODIGI_EU_COUNTRIES.has(opts.countryCode)
    ? Math.round(preTaxCents * PRODIGI_VAT_RATE)
    : 0
  return {
    artistCents,
    galleryCents,
    prodigiItemCents: opts.prodigiItemCents,
    prodigiShippingCents: opts.prodigiShippingCents,
    preTaxCents,
    customerVatCents,
    totalCents: preTaxCents + customerVatCents,
  }
}

export type PriceBreakdown = {
  prodigiCostCents: number
  artistPriceCents: number
  galleryCutCents: number
  subtotalCents: number
  vatCents: number
  totalCents: number
  partial: boolean
}

export function computePrice(
  config: ProdigiConfig,
  opts: { printPriceCents: number; vatRate?: number },
): PriceBreakdown {
  const prodigi = estimateProdigiCostCents(config) ?? 0
  const artist = opts.printPriceCents
  const gallery = Math.round(artist * PRODIGI_GALLERY_MARKUP_RATE)
  const subtotal = prodigi + artist + gallery
  const vatRate = opts.vatRate ?? PRODIGI_VAT_RATE
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

/** Orientation-aware dual-unit size label, e.g. `40 × 50 cm (15.7″ × 19.7″)`. */
export function formatSize(
  size: { widthCm: number; heightCm: number },
  orientation?: Orientation,
): string {
  const isLandscape = orientation === 'landscape'
  const wCm = isLandscape ? size.heightCm : size.widthCm
  const hCm = isLandscape ? size.widthCm : size.heightCm
  return formatDualDimensions(wCm, hCm)
}

export { getProdigiSize }
