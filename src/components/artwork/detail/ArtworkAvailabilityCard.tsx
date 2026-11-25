'use client'

import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import type { ArtworkSizes } from '@/lib/editions/artworkSizes'
import { formatDisplayPrice } from '@/lib/editions/formatDisplayPrice'
import { editionLineText } from '@/lib/editions/editionLineText'
import type { VariantEditionLineParts } from '@/lib/editions/variantEditionLines'
import { formatDimensions, type Unit } from '@/lib/units/format'
import { useUnits } from '@/lib/units/UnitsProvider'
import { usePrintWizard } from './usePrintWizard'

import styles from './ArtworkAvailabilityCard.module.scss'

/**
 * The print part of the artwork page's info column (docs/public-redesign/units.md "Artwork page:
 * the print, its sizes and its price together"; owner, 2026-11-17: "I don't want to make users
 * guess… do not be too verbose either"): what kind of print it is, its sizes, the price, Order a
 * print, then the caller's Inquire. The same block in the 3D room's artwork details. No "Not
 * reserved until you pay" line under the buttons (owner, 2026-11-20: too pushy); the order
 * wizard's limited step still says it.
 *
 * - Open edition: Smallest / Largest, "or any size in between.", From €303 + Available (no "Size,
 *   paper and frame are chosen next." line: owner, 2026-11-20).
 * - Limited, one size: the size, "Edition 3 of 30" (the copy a buyer gets), the price + Available.
 * - Limited, two or more: "Available in two sizes:", one row per edition, cheapest first (size;
 *   Edition 3 of 30, no size name; price on the right, or Sold out), Available under the rows.
 *   Visitors never see the word "variant". Two editions of one size (other paper) are "versions",
 *   and their rows name the paper.
 *
 * Sizes in the visitor's unit (the footer's cm | in, the only switch: owner, 2026-11-25); the words
 * never change. Rendered only when the work is for sale; otherwise the column's size line under the
 * year says the sizes (`artworkSizesText`) and Inquire follows (artwork.md "Info column, refined").
 */
type ArtworkAvailabilityCardProps = {
  editionType: 'open' | 'limited'
  /** The file's printable range: the open edition's Smallest / Largest. */
  sizes?: ArtworkSizes | null
  /** Cheapest completable purchase. `null` means live but sold out. */
  minPriceCents: number | null
  /** Every live edition, cheapest first (limited editions only). */
  editionLines?: VariantEditionLineParts[]
  artworkSlug: string
  /** The Inquire button, set under Order a print. */
  inquire?: ReactNode
}

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n)

const sizeOf = (line: VariantEditionLineParts, unit: Unit) =>
  formatDimensions(line.widthCm, line.heightCm, unit)

/** "Edition 3 of 30" — the copy a buyer gets, the number the renders pencil — or "Edition of 30"
 *  once sold out (the price says Sold out). */
const stockText = (line: VariantEditionLineParts) => editionLineText(line)

export const ArtworkAvailabilityCard = ({
  editionType,
  sizes,
  minPriceCents,
  editionLines = [],
  artworkSlug,
  inquire,
}: ArtworkAvailabilityCardProps) => {
  const openWizard = usePrintWizard(artworkSlug)
  const { unit } = useUnits()
  const soldOut = minPriceCents === null
  const isLimited = editionType === 'limited' && editionLines.length > 0

  const status = (
    <span className={soldOut ? styles.statusSoldOut : styles.status}>
      {!soldOut && <span className={styles.dot} aria-hidden />}
      {soldOut ? 'Sold out' : 'Available'}
    </span>
  )

  return (
    <div className={styles.card}>
      <KindLine kind={isLimited ? 'Limited edition print' : 'Open edition print'} />

      {!isLimited && (
        <>
          <OpenRange sizes={sizes} unit={unit} />
          <div className={styles.priceRow}>
            {minPriceCents !== null && (
              <span className={styles.price}>
                <span className={styles.from}>From</span> {formatDisplayPrice(minPriceCents)}
              </span>
            )}
            {status}
          </div>
        </>
      )}

      {isLimited && editionLines.length === 1 && (
        <>
          <div className={styles.single}>
            <span className={styles.rowSize}>{sizeOf(editionLines[0], unit)}</span>
            <span className={styles.rowMeta}>{stockText(editionLines[0])}</span>
          </div>
          <div className={styles.priceRow}>
            {!soldOut && editionLines[0].price && (
              <span className={styles.price}>{editionLines[0].price}</span>
            )}
            {status}
          </div>
        </>
      )}

      {isLimited && editionLines.length > 1 && (
        <LimitedRows lines={editionLines} unit={unit} soldOut={soldOut} status={status} />
      )}

      {!soldOut && (
        <Button
          variant="primary"
          label="Order a print"
          onClick={openWizard}
          className={styles.cta}
        />
      )}

      {inquire}
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
  status,
}: {
  lines: VariantEditionLineParts[]
  unit: Unit
  soldOut: boolean
  status: ReactNode
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
      <div className={styles.statusRow}>{status}</div>
    </>
  )
}
