import prisma from '@/lib/prisma'

import { TPS_PAPERS } from '@/lib/print-providers/printspace'

import { formatDisplayPrice } from './formatDisplayPrice'
import { minimumPriceForLimited } from './minimumPrice'
import { LIVE_VARIANT_WHERE } from './printable'

/**
 * The edition lines shown on an artwork page — one per live variant.
 *
 * A single photograph is several editions: `editionSize` lives on the VARIANT,
 * not the artwork, so "50x40 Baryta" and "70x60 Baryta" of the same image can be
 * editions of 30 and 10 respectively, each numbered independently.
 *
 * The number shown is the copy the buyer is ABOUT TO GET, so the line reads
 * forward — "this one becomes yours" — instead of reporting how many have
 * already gone.
 *
 * Two visitors can be shown the same number at once and whoever pays first takes
 * it. That is deliberate: editions are NOT reserved before payment, and the
 * card's "not reserved until you pay" sentence is the whole mitigation. It is
 * not a reason to reintroduce holds.
 */
export type VariantEditionLine = {
  /** The variant's own free-text name, which already encodes size and paper. */
  variantName: string
  /** This variant's edition size — never the artwork's. */
  editionSize: number
  /** Copies not yet PAID for: the edition size minus the sold copies. A copy held
   *  by an unfinished checkout still counts as left, so an abandoned checkout never
   *  moves it — only a sale does (see below). */
  left: number
  /** True once every copy has sold. */
  soldOut: boolean
  /** What this edition costs, excluding shipping and tax. Price is NOT common
   *  across a work's editions — each variant is its own size, paper and figure —
   *  so it belongs on the row, never as one number above them all. */
  priceCents: number | null
  /** The print's size (not the sheet), for the size row (owner, 2026-11-17). */
  widthCm: number
  heightCm: number
  /** Named on the row only when two editions share a size (units.md). */
  paperId: string
}

/**
 * A line as the artwork page's print block lays it out (docs/public-redesign/units.md "Artwork
 * page: the print, its sizes and its price together"): the size over "Medium · Edition of 30 · 28
 * left", the price on the right. Plain data, so the client writes the size in the visitor's unit.
 */
export type VariantEditionLineParts = {
  /** The variant's own name, e.g. "Medium". Visitors never see the word "variant". */
  name: string
  /** The paper's name, shown on the row only when two editions share a size. */
  paper: string
  widthCm: number
  heightCm: number
  editionSize: number
  /** Copies not yet sold (see `VariantEditionLine.left`). */
  left: number
  soldOut: boolean
  /** "€312", or null when the variant carries no usable price. */
  price: string | null
}

export function variantEditionLineParts(line: VariantEditionLine): VariantEditionLineParts {
  return {
    name: line.variantName,
    paper: TPS_PAPERS.find((paper) => paper.id === line.paperId)?.label ?? line.paperId,
    widthCm: line.widthCm,
    heightCm: line.heightCm,
    editionSize: line.editionSize,
    left: line.left,
    soldOut: line.soldOut,
    price: line.priceCents === null ? null : formatDisplayPrice(line.priceCents),
  }
}

/**
 * One line per live variant, smallest print first: its size, name, edition size, copies left and
 * price.
 *
 * "28 left" (owner, 2026-11-17) counts SOLD copies only: edition size minus the copies paid for.
 * The counts tried before misled because they moved with checkouts, or read as a copy number:
 *
 *   lowest AVAILABLE — a number is reserved the moment a PaymentIntent exists,
 *     so an abandoned checkout consumed one and a live edition advanced from
 *     "2 of 50" to "4 of 50" with nothing sold.
 *   max(sold) + 1 — reads as a promise of a particular copy, which nobody can
 *     make: the copy is decided when payment confirms, and someone else may pay
 *     first.
 *   max(sold) — accurate, but "6 of 50" is the EDITION-NUMBER convention. Every
 *     collector reads it as "this is copy 6", so the truest number was also the
 *     most misleading thing on the page.
 *
 * "N left" is neither: it is not a copy number, and with sold copies only, a
 * reservation (an unfinished checkout) cannot move it. The buyer still learns their
 * own number when production starts.
 */
export async function getVariantEditionLines(
  artworkId: string,
  /** The gallery's commission rate the caller read for this request. */
  galleryRate: number,
): Promise<VariantEditionLine[]> {
  const variants = await prisma.limitedVariant.findMany({
    where: { artworkId, ...LIVE_VARIANT_WHERE },
    orderBy: { editionSize: 'desc' },
    select: {
      name: true,
      editionSize: true,
      priceCents: true,
      paperId: true,
      printTypeId: true,
      widthCm: true,
      heightCm: true,
      borderCm: true,
      sheetWidthCm: true,
      sheetHeightCm: true,
      // Sold copies only. A reserved one belongs to an unfinished checkout and
      // counts for nothing — only the Stripe webhook sets `sold`, so it is the
      // single state that means money arrived.
      _count: { select: { editionNumbers: { where: { state: 'sold' } } } },
    },
  })

  const lines = variants.map((v) => ({
    variantName: v.name,
    editionSize: v.editionSize,
    // Counted rather than compared against the highest number sold, which a gap in
    // the ledger would make wrong.
    left: Math.max(0, v.editionSize - v._count.editionNumbers),
    soldOut: v._count.editionNumbers >= v.editionSize,
    widthCm: v.widthCm,
    heightCm: v.heightCm,
    paperId: v.paperId,
    // Priced by handing this variant ALONE to the same function that picks the
    // cheapest across all of them. Same arithmetic, so a row's figure and the
    // card's minimum cannot drift apart.
    priceCents: minimumPriceForLimited([v], galleryRate)?.cents ?? null,
  }))
  // Smallest print first (units.md): the rows read as a run of sizes.
  return lines.sort((a, b) => a.widthCm * a.heightCm - b.widthCm * b.heightCm)
}
