'use server'

import type { GetQuoteInput, Quote, QuoteLine } from '../types'
import type { TpsFrameTypeId, TpsGlassId, TpsHangingId } from './data'
import {
  TPS_GALLERY_MARKUP_RATE,
  TPS_HANGING_SUPPLEMENT_CENTS,
  TPS_SHIPPING_PRINTS_CENTS,
  TPS_VAT_RATE,
  getFrameShippingCents,
  getFrameSupplementCents,
  getGlassSupplementCents,
  getMountBoardSupplementCents,
  getPrintBaseCents,
  isEuVatCountry,
  resolveTpsRegion,
} from './pricing'

/**
 * The Print Space quote — composed from approximate hardcoded tables
 * (see ./pricing.ts). TPS doesn't expose live prices via API; the
 * gallery accepts a small variance and rounds slightly upward so the
 * delta always lands in the gallery's favour, never the buyer's.
 *
 * Composition:
 *   subtotal = artist + gallery markup + print base + frame + glass + hanging + shipping
 *   tax      = 21% on subtotal when shipping to an EU country
 *   total    = subtotal + tax
 */
export async function getPrintspaceQuote(input: GetQuoteInput): Promise<Quote> {
  const { config, country, artistPriceCents } = input

  // Effective size — TPS sells custom sizes only, but `customSize`
  // may be absent on a brand-new wizard render. Fall back to a
  // sensible default so we always return a quote shape rather than
  // throwing.
  const widthCm = config.customSize?.widthCm ?? 21
  const heightCm = config.customSize?.heightCm ?? 30
  const region = resolveTpsRegion(country)

  const formatId = config.values.format
  const isFramed = formatId === 'framing'
  const frameTypeId = config.values.frameType as TpsFrameTypeId | undefined
  const glassId = (config.values.glass as TpsGlassId | undefined) ?? 'none'
  const hangingId = (config.values.hanging as TpsHangingId | undefined) ?? 'none'

  // Print base — same approximate per-tier number across paper /
  // print-type variants. Bias upward so paper variance never
  // underprices.
  const printBaseCents = getPrintBaseCents(widthCm, heightCm)

  // Frame supplement — only when framed; depends on frame type.
  const frameSupplementCents =
    isFramed && frameTypeId ? getFrameSupplementCents(frameTypeId, widthCm, heightCm) : 0

  // Glass — Anti Reflective scales with frame size (None / Standard
  // are bundled free). Only relevant when framed.
  const glassCents = isFramed ? getGlassSupplementCents(glassId, widthCm, heightCm) : 0
  // Hanging — flat per option, all currently €0.
  const hangingCents = isFramed ? (TPS_HANGING_SUPPLEMENT_CENTS[hangingId] ?? 0) : 0
  // Window mount (passepartout) — proportional to mount width when
  // a non-'none' colour is picked AND the buyer has set a width.
  const mountId = config.values.windowMount as string | undefined
  const mountWidthCm = config.borders?.['windowMountSize']?.allCm ?? 0
  const mountCents =
    isFramed && mountId && mountId !== 'none' ? getMountBoardSupplementCents(mountWidthCm) : 0

  // Gallery markup on the artist's price.
  const galleryCents = Math.round(artistPriceCents * TPS_GALLERY_MARKUP_RATE)

  // Shipping — flat per-print rate when not framed; tiered per-frame
  // rate when framed (long-edge cm).
  const shippingCents = isFramed
    ? getFrameShippingCents(region, widthCm, heightCm)
    : TPS_SHIPPING_PRINTS_CENTS[region]

  // Wizard summary lumps artwork + production into a single "Artwork"
  // line and shows shipping separately.
  const artworkLineCents =
    artistPriceCents +
    galleryCents +
    printBaseCents +
    frameSupplementCents +
    glassCents +
    hangingCents +
    mountCents

  const subtotalCents = artworkLineCents + shippingCents
  const taxCents = isEuVatCountry(country) ? Math.round(subtotalCents * TPS_VAT_RATE) : 0
  const totalCents = subtotalCents + taxCents

  const lines: QuoteLine[] = [
    { id: 'artwork', label: 'Artwork', amountCents: artworkLineCents },
    { id: 'shipping', label: 'Shipping', amountCents: shippingCents, muted: true },
  ]

  return {
    currency: 'EUR',
    lines,
    subtotalCents,
    taxCents,
    taxLabel: taxCents > 0 ? 'VAT (21%)' : undefined,
    totalCents,
  }
}
