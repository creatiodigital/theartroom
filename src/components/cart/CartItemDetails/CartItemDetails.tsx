'use client'

import type { CSSProperties, ReactNode } from 'react'
import c from 'classnames'

import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'
import { editionLabel } from '@/lib/editions/editionLabel'
import { specLines } from '@/lib/cart/specLines'
import type { CartItem } from '@/lib/cart/types'

import styles from './CartItemDetails.module.scss'

type Props = {
  item: CartItem
  /**
   * The square thumbnail's size in px (120 drawn). The work is contained in it on the render-wall
   * grey, never cropped, so portrait and landscape lines take the same room. 88 px on phones.
   */
  thumbHeight?: number
  /** Per-line server-revalidation error (checkout). */
  error?: string
  /** Whether to show the edition line ("Open edition", "Limited edition · S1"). */
  showEditionTag?: boolean
  /** Under the specs: the cart's Edit and Remove. */
  actions?: ReactNode
  /** The right-hand column: the cart's price and quantity. Under the text on phones. */
  aside?: ReactNode
}

/**
 * One cart item as the order flow draws it (docs/public-redesign/order-flow.md "Cart",
 * designs/cart.dc.html, checkout-2-review.dc.html): the thumbnail, the title in serif italics,
 * the artist, the edition in small caps and the choices as short lines (`specLines`). Shared by
 * the cart and the checkout so the two never drift; each supplies its own controls.
 */
export const CartItemDetails = ({
  item,
  thumbHeight = 120,
  error,
  showEditionTag = true,
  actions,
  aside,
}: Props) => {
  const lines = specLines(item.specsSummary)
  return (
    <div
      className={c(styles.item, aside !== undefined && styles.withAside)}
      style={{ '--thumb-size': `${thumbHeight}px` } as CSSProperties}
    >
      <ProtectedImage
        src={item.thumbnailUrl}
        alt={item.title}
        // 0×0 + CSS sizing: next/image's pattern for sources of unknown intrinsic size; the
        // stylesheet makes it a contained square.
        width={0}
        height={0}
        wrapperClassName={styles.thumb}
        className={styles.thumbImage}
      />

      <div className={styles.details}>
        <p className={styles.title}>
          <em>{item.title}</em>
        </p>
        <span className={styles.artist}>{item.artistName}</span>

        {showEditionTag && (
          <span className={styles.edition}>{editionLabel(item.editionType, item.editionName)}</span>
        )}

        {lines.length > 0 && (
          <div className={styles.specs}>
            {lines.map((line, index) => (
              <span key={index}>{line}</span>
            ))}
          </div>
        )}

        {error && <span className={styles.errorText}>{error}</span>}

        {actions && <div className={styles.actions}>{actions}</div>}
      </div>

      {aside !== undefined && <div className={styles.aside}>{aside}</div>}
    </div>
  )
}
