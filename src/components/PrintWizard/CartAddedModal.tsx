'use client'

import { useEffect, useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react'

import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'
import { lineTotal } from '@/lib/cart/cartMath'
import type { CartItem } from '@/lib/cart/types'
import { editionLabel } from '@/lib/editions/editionLabel'
import { formatEuro } from '@/lib/print-providers'

import styles from './PrintWizard.module.scss'

/** The line just added: what the toast shows of it. */
export type AddedLine = Pick<
  CartItem,
  | 'title'
  | 'artistName'
  | 'thumbnailUrl'
  | 'editionType'
  | 'editionName'
  | 'quantity'
  | 'unitArtistCents'
  | 'unitProductionCents'
  | 'unitGalleryCents'
>

type Props = {
  /** The line just added (or, when editing, the line as it now stands). */
  item: AddedLine
  /** Dismiss the confirmation (unmounts it). */
  onClose: () => void
  /** True when the buyer was editing an existing line — the copy reads
   *  "updated" rather than "added". */
  edited?: boolean
}

/** How long the confirmation stays fully visible before it starts fading. */
const VISIBLE_MS = 2500
/** Fade-out duration — keep in sync with the transition in PrintWizard.module.scss. */
const FADE_MS = 400

/**
 * Brief, self-dismissing confirmation shown after a successful add-to-cart, in the look of
 * docs/public-redesign/other-screens.md "Added to cart" (owner, Q-P19 b): the check, *Added to
 * your cart*, and the item row (thumbnail, title, edition, price). No actions: it fades out on its
 * own so the buyer can keep configuring the next print; the summary panel's Continue shopping /
 * Go to cart stay as they are. `role="status"` announces it politely without stealing focus.
 */
export const CartAddedModal = ({ item, onClose, edited = false }: Props) => {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), VISIBLE_MS)
    const close = setTimeout(onClose, VISIBLE_MS + FADE_MS)
    return () => {
      clearTimeout(fade)
      clearTimeout(close)
    }
  }, [onClose])

  return (
    <div
      className={`${styles.cartAddedBanner} ${leaving ? styles.cartAddedLeaving : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.cartAddedCard}>
        <p className={styles.cartAddedTitle}>
          <CheckCircle size={22} weight="light" aria-hidden className={styles.cartAddedCheck} />
          {edited ? 'Your cart has been updated' : 'Added to your cart'}
        </p>
        <div className={styles.cartAddedItem}>
          <ProtectedImage
            src={item.thumbnailUrl}
            alt=""
            width={0}
            height={0}
            wrapperClassName={styles.cartAddedThumb}
            className={styles.cartAddedThumbImage}
          />
          <span className={styles.cartAddedText}>
            <em className={styles.cartAddedWork}>{item.title}</em>
            <span className={styles.cartAddedArtist}>{item.artistName}</span>
            <span className={styles.cartAddedEdition}>
              {editionLabel(item.editionType, item.editionName)}
              {item.quantity > 1 ? ` · ${item.quantity}` : ''}
            </span>
          </span>
          <span className={styles.cartAddedPrice}>{formatEuro(lineTotal(item).lineItemCents)}</span>
        </div>
      </div>
    </div>
  )
}
