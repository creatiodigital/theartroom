'use client'

import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { TakeAPeek } from '@/components/ui/TakeAPeek'
import type { ArtworkSizes } from '@/lib/editions/artworkSizes'
import { formatDisplayPrice } from '@/lib/editions/formatDisplayPrice'
import { editionLineText } from '@/lib/editions/editionLineText'
import type { VariantEditionLineParts } from '@/lib/editions/variantEditionLines'
import { formatDimensions, type Unit } from '@/lib/units/format'
import { useUnits } from '@/lib/units/UnitsProvider'
import { PrintAnswers } from './PrintAnswers'
import { usePrintWizard } from './usePrintWizard'

import styles from './ArtworkAvailabilityCard.module.scss'

/**
 * The print part of the artwork page's info column, in two places (owner, 2026-11-25: "Move the
 * buttons and price below the year + divider", "remove the Inquire button if we show an order
 * print"):
 *
 * - `ArtworkPurchase`, right under the year's divider: the price and Available, then Order a print;
 *   no Inquire beside it. Sold out: "Sold out" and the caller's Inquire instead of the button.
 * - `ArtworkPrintDetails`, further down: what kind of print it is and its sizes (docs/public-redesign
 *   /units.md "Artwork page: the print, its sizes and its price together"; owner, 2026-11-17: "I
 *   don't want to make users guess… do not be too verbose either").
 *
 * - Open edition: "From €303" + Available; below, Smallest / Largest, "or any size in between.".
 * - Limited, one size: "€284" + Available; below, the size and "Edition 3 of 30" (the copy a buyer
 *   gets).
 * - Limited, two or more: the cheapest edition in stock to the dearest, "€445–€653", as the grids
 *   write it (salePriceLabel); below, "Available in two sizes:" and one row per edition, cheapest
 *   first (size; Edition 3 of 30; its price on the right, or Sold out). Visitors never see the word
 *   "variant". Two editions of one size (other paper) are "versions", and their rows name the paper.
 *
 * Sizes in the visitor's unit (the footer's cm | in, the only switch); the words never change.
 * Rendered only when the work is for sale. The same in the 3D room's artwork details.
 */
type PrintSaleProps = {
  editionType: 'open' | 'limited'
  /** Cheapest completable purchase. `null` means live but sold out. */
  minPriceCents: number | null
  /** Every live edition, cheapest first (limited editions only). */
  editionLines?: VariantEditionLineParts[]
}

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n)

const sizeOf = (line: VariantEditionLineParts, unit: Unit) =>
  formatDimensions(line.widthCm, line.heightCm, unit)

/** "Edition 3 of 30" — the copy a buyer gets, the number the renders pencil — or "Edition of 30"
 *  once sold out (the price says Sold out). */
const stockText = (line: VariantEditionLineParts) => editionLineText(line)

const isLimitedSale = (editionType: string, editionLines: VariantEditionLineParts[]) =>
  editionType === 'limited' && editionLines.length > 0

/** The price under the year: "From €303", "€284", or the in-stock range "€445–€653". */
function purchasePrice({ editionType, minPriceCents, editionLines = [] }: PrintSaleProps) {
  if (minPriceCents === null) return null
  if (!isLimitedSale(editionType, editionLines)) {
    return (
      <>
        <span className={styles.from}>From</span> {formatDisplayPrice(minPriceCents)}
      </>
    )
  }
  const prices = editionLines
    .filter((line) => !line.soldOut && line.price)
    .map((line) => line.price)
  if (prices.length === 0) return formatDisplayPrice(minPriceCents)
  const [low, high] = [prices[0], prices[prices.length - 1]]
  return low === high ? low : `${low}–${high}`
}

export const ArtworkPurchase = ({
  artworkSlug,
  title,
  surface,
  inquire,
  ...sale
}: PrintSaleProps & {
  artworkSlug: string
  /** The work's title, for Take a peek's "Order a print of {title}". */
  title: string
  /** `room`: the 3D room's pop-up (Take a peek counts it apart). */
  surface: 'page' | 'room'
  /** Inquire, shown only when there is nothing left to order. */
  inquire?: ReactNode
}) => {
  const openWizard = usePrintWizard(artworkSlug)
  const soldOut = sale.minPriceCents === null
  const price = purchasePrice(sale)
  return (
    <div className={styles.card}>
      <div className={styles.priceRow}>
        {price && <span className={styles.price}>{price}</span>}
        <span className={soldOut ? styles.statusSoldOut : styles.status}>
          {!soldOut && <span className={styles.dot} aria-hidden />}
          {soldOut ? 'Sold out' : 'Available'}
        </span>
      </div>
      {soldOut ? (
        inquire
      ) : (
        <>
          <Button
            variant="primary"
            label="Order a print"
            onClick={openWizard}
            className={styles.cta}
          />
          {/* What arrives at your door (docs/take-a-peek, P2): right under Order a print, only while
              there is a print to order; its window orders this work. */}
          <TakeAPeek
            size="inline"
            placement={surface === 'room' ? 'room' : 'artwork'}
            order={{ title, onOrder: openWizard }}
          />
          {/* Folded answers (docs/take-a-peek T7): what's in the box, time, shipping, returns. */}
          <PrintAnswers editionType={sale.editionType} />
        </>
      )}
    </div>
  )
}

export const ArtworkPrintDetails = ({
  editionType,
  sizes,
  minPriceCents,
  editionLines = [],
}: PrintSaleProps & {
  /** The file's printable range: the open edition's Smallest / Largest. */
  sizes?: ArtworkSizes | null
}) => {
  const { unit } = useUnits()
  const isLimited = isLimitedSale(editionType, editionLines)
  return (
    <div className={styles.card}>
      <KindLine kind={isLimited ? 'Limited edition print' : 'Open edition print'} />
      {!isLimited && <OpenRange sizes={sizes} unit={unit} />}
      {isLimited && editionLines.length === 1 && (
        <div className={styles.single}>
          <span className={styles.rowSize}>{sizeOf(editionLines[0], unit)}</span>
          {/* Same font and color as the size above it (owner, 2026-11-25). */}
          <span className={styles.rowSize}>{stockText(editionLines[0])}</span>
        </div>
      )}
      {isLimited && editionLines.length > 1 && (
        <LimitedRows lines={editionLines} unit={unit} soldOut={minPriceCents === null} />
      )}
    </div>
  )
}

/** The kind of print. No cm | in after it: the footer's switch is the only one (owner, 2026-11-25). */
const KindLine = ({ kind }: { kind: string }) => <p className={styles.kind}>{kind}</p>

/** Smallest / Largest, then "or any size in between." Nothing when the file has no range. */
const OpenRange = ({ sizes, unit }: { sizes?: ArtworkSizes | null; unit: Unit }) => {
  if (sizes?.kind !== 'range') return null
  return (
    <>
      <dl className={styles.range}>
        <dt>Smallest</dt>
        <dd>{formatDimensions(sizes.min.widthCm, sizes.min.heightCm, unit)}</dd>
        <dt>Largest</dt>
        <dd>{formatDimensions(sizes.max.widthCm, sizes.max.heightCm, unit)}</dd>
      </dl>
      <p className={styles.between}>or any size in between.</p>
    </>
  )
}

const LimitedRows = ({
  lines,
  unit,
  soldOut,
}: {
  lines: VariantEditionLineParts[]
  unit: Unit
  soldOut: boolean
}) => {
  // Two editions of one size differ only by paper: they are "versions", and the paper is named.
  const sizeKeys = lines.map((line) => sizeOf(line, 'cm'))
  const sharedSize = new Set(sizeKeys).size < sizeKeys.length
  const noun = sharedSize ? 'versions' : 'sizes'
  return (
    <>
      <p className={styles.countLine}>
        {soldOut ? 'In' : 'Available in'} {countWord(lines.length)} {noun}:
      </p>
      <ul className={styles.rows}>
        {lines.map((line, index) => (
          <li key={`${line.name}-${index}`} className={styles.row}>
            <span className={styles.rowText}>
              <span className={styles.rowSize}>{sizeOf(line, unit)}</span>
              <span className={styles.rowMeta}>
                {/* No size name ("Small 20"): the size itself is on the row (owner, 2026-11-20). */}
                {[sharedSize ? line.paper : null, stockText(line)].filter(Boolean).join(' · ')}
              </span>
            </span>
            {line.soldOut ? (
              <span className={styles.rowSoldOut}>Sold out</span>
            ) : (
              line.price && <span className={styles.rowPrice}>{line.price}</span>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
