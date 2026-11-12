'use client'

import type { ReactNode } from 'react'
import { ShoppingBagOpen } from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'
import { formatDisplayPrice } from '@/lib/editions/formatDisplayPrice'
import type { VariantEditionLineParts } from '@/lib/editions/variantEditionLines'
import { usePrintWizard } from './usePrintWizard'

import styles from './ArtworkAvailabilityCard.module.scss'

/**
 * The purchase block of the artwork page's info column (docs/public-redesign/artwork.md,
 * designs/artwork-*.dc.html): the price in serif with the availability on its right, the edition
 * line, Order a print, then the caller's Inquire, then the one caveat that matters.
 *
 * The price is the cheapest live configuration (the one `minimumPrice` costed). A work with
 * several live editions lists each with its own price instead: the price is not common across a
 * work's editions, and a single figure would describe only one of them.
 *
 * Rendered only when the work is actually for sale — a piece that is not for sale shows no trace
 * of commerce, only Inquire.
 */
type ArtworkAvailabilityCardProps = {
  editionType: 'open' | 'limited'
  /** Cheapest completable purchase. `null` means live but sold out. */
  minPriceCents: number | null
  /** EVERY live edition, not just the one the price was costed from. The button
   *  opens a picker showing all of them, so a card naming one would promise an
   *  edition the next screen does not single out. */
  editionLines?: VariantEditionLineParts[]
  artworkSlug: string
  /** The Inquire button, set between Order a print and the caveat. */
  inquire?: ReactNode
}

export const ArtworkAvailabilityCard = ({
  editionType,
  minPriceCents,
  editionLines = [],
  artworkSlug,
  inquire,
}: ArtworkAvailabilityCardProps) => {
  const openWizard = usePrintWizard(artworkSlug)
  const soldOut = minPriceCents === null
  const isLimited = editionType === 'limited'
  const editionWord = isLimited ? 'Limited edition' : 'Open edition'

  // One figure beside the availability when there is one thing to price: an open edition, or a
  // limited work with a single edition. Several editions are priced row by row below.
  const topPrice =
    editionLines.length === 0
      ? minPriceCents !== null
        ? formatDisplayPrice(minPriceCents)
        : null
      : editionLines.length === 1
        ? editionLines[0].price
        : null

  return (
    <div className={styles.card}>
      <div className={styles.priceRow}>
        {topPrice && <span className={styles.price}>{topPrice}</span>}
        <span className={soldOut ? styles.statusSoldOut : styles.status}>
          {!soldOut && <span className={styles.dot} aria-hidden />}
          {soldOut ? 'Sold out' : 'Available'}
        </span>
      </div>

      {/* The edition named once: "Limited edition · S1 · Edition of 30". A sold-out edition
          stays listed and says so — it is still real, and dropping it would read as if it
          never existed. */}
      {editionLines.length === 0 ? (
        <p className={styles.editionLine}>{editionWord}</p>
      ) : (
        <ul className={styles.editions}>
          {editionLines.map((line) => (
            <li key={`${line.name}-${line.count}`} className={styles.editionLine}>
              <span>
                {editionWord} · {line.name} · {line.count}
              </span>
              {editionLines.length > 1 && line.price && (
                <span className={styles.rowPrice}>{line.price}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!soldOut && (
        <Button
          variant="primary"
          label="Order a print"
          iconLeft={<ShoppingBagOpen size={18} weight="light" aria-hidden />}
          onClick={openWizard}
          className={styles.cta}
        />
      )}

      {inquire}

      {/* Limited only: on an open edition nothing can be taken first and the sentence would
          simply be untrue. Editions are deliberately NOT held before payment — this line is the
          whole mitigation, and saying it plainly is what keeps a lost race from feeling like a
          trick. */}
      {isLimited && !soldOut && (
        <p className={styles.caveat}>
          Not reserved until you pay: another collector may take it first.
        </p>
      )}
      {/* Phones: an open edition's choices come next (artwork.md "Phone"). */}
      {!isLimited && !soldOut && (
        <p className={styles.phoneNote}>Frame, paper and size are chosen in the next step.</p>
      )}
    </div>
  )
}
