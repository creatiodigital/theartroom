'use client'

import type { ComponentProps, ReactNode } from 'react'
import { useId, useState } from 'react'
import c from 'classnames'
import { CaretDown } from '@phosphor-icons/react'

import { ArrowLink } from '@/components/ui/ArrowLink'
import { Button } from '@/components/ui/Button'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'
import { cartCount, cartSubtotal, lineTotal } from '@/lib/cart/cartMath'
import { specShortLine } from '@/lib/cart/specLines'
import type { CartItem } from '@/lib/cart/types'
import type { CartTotals } from '@/lib/cart/validateCart'
import { vatLabel } from '@/lib/checkout/vatLabel'
import { formatEuro } from '@/lib/print-providers'

import styles from './CheckoutParts.module.scss'

/**
 * The order flow's checkout pieces (docs/public-redesign/order-flow.md "Checkout", "Order confirmed";
 * designs/checkout-*.dc.html, order-confirmed.dc.html), shared by the cart checkout and, from step 39,
 * the single-work print path.
 */

/** The off-white panel on the right: a serif title over the order's items and totals. */
export const CheckoutAside = ({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) => {
  const titleId = useId()
  return (
    <aside className={c(styles.aside, className)} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.asideTitle}>
        {title}
      </h2>
      {children}
    </aside>
  )
}

function editionShort(item: Pick<CartItem, 'editionType' | 'editionName'>): string {
  if (item.editionType === 'open') return 'Open edition'
  return item.editionName ? `Limited, ${item.editionName}` : 'Limited edition'
}

/** The compact item rows of the right-hand panel: 64 px thumbnail, title, artist and edition, size. */
export const OrderItems = ({
  items,
  errors,
}: {
  items: CartItem[]
  /** lineId → "no longer available" message from the server revalidation. */
  errors?: Record<string, string>
}) => (
  <ul className={styles.items}>
    {items.map((item) => {
      const short = specShortLine(item.specsSummary)
      const error = errors?.[item.lineId]
      return (
        <li key={item.lineId} className={styles.item}>
          <ProtectedImage
            src={item.thumbnailUrl}
            alt={item.title}
            width={0}
            height={0}
            wrapperClassName={styles.itemThumb}
            className={styles.itemThumbImage}
          />
          <div className={styles.itemText}>
            <span className={styles.itemTitle}>
              <em>{item.title}</em>
            </span>
            <span className={styles.itemMeta}>
              {item.artistName} · {editionShort(item)}
            </span>
            {(short || item.quantity > 1) && (
              <span className={styles.itemSpec}>
                {short}
                {short && item.quantity > 1 && ' · '}
                {item.quantity > 1 && (
                  <span className={styles.nowrap}>Quantity {item.quantity}</span>
                )}
              </span>
            )}
            {error && <span className={styles.itemError}>{error}</span>}
          </div>
          <span className={styles.itemPrice}>{formatEuro(lineTotal(item).lineItemCents)}</span>
        </li>
      )
    })}
  </ul>
)

/** Items, shipping, VAT and the total in serif. */
export const Totals = ({
  totals,
  totalLabel = 'Total',
}: {
  /** The checkout's totals, or the confirmation's as read from the order. */
  totals: Pick<
    CartTotals,
    'itemsPreTaxCents' | 'shippingCents' | 'customerVatCents' | 'vatRate' | 'totalCents'
  >
  /** "Total, authorized" on the confirmation. */
  totalLabel?: string
}) => (
  <dl className={styles.totals}>
    <div className={styles.totalRow}>
      <dt>Items</dt>
      <dd>{formatEuro(totals.itemsPreTaxCents)}</dd>
    </div>
    <div className={styles.totalRow}>
      <dt>Shipping</dt>
      <dd>{formatEuro(totals.shippingCents)}</dd>
    </div>
    <div className={styles.totalRow}>
      <dt>{vatLabel(totals.vatRate)}</dt>
      <dd>{formatEuro(totals.customerVatCents)}</dd>
    </div>
    <div className={c(styles.totalRow, styles.grandTotal)}>
      <dt>{totalLabel}</dt>
      <dd>{formatEuro(totals.totalCents)}</dd>
    </div>
  </dl>
)

function editionLabel(item: Pick<CartItem, 'editionType' | 'editionName'>): string {
  if (item.editionType === 'open') return 'Open edition'
  return item.editionName ? `Limited edition · ${item.editionName}` : 'Limited edition'
}

/**
 * Checkout v2's order (order-flow.md "Checkout v2", designs/checkout-v2.dc.html): on the left of
 * every step, as the cart's items are (owner, 2026-11-13: the order never changes sides). "Your
 * order" with → Edit cart, the item rows, then the figures: the items' sum and "Calculated after the
 * address" until the address is known (`totals` absent), then shipping, VAT and the total. Sticky
 * beside the step from 1024 px. On phones it folds into a bar under the title (the prints and the
 * current amount) that opens it.
 */
export const OrderColumn = ({
  items,
  totals,
  errors,
}: {
  items: CartItem[]
  /** The server's figures once the address is known (Review, Payment). */
  totals?: Pick<
    CartTotals,
    'itemsPreTaxCents' | 'shippingCents' | 'customerVatCents' | 'vatRate' | 'totalCents'
  > | null
  /** lineId → "no longer available" message from the server revalidation. */
  errors?: Record<string, string>
}) => {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const bodyId = useId()
  const prints = cartCount(items)
  const itemsCents = cartSubtotal(items)
  return (
    <aside className={styles.order} aria-labelledby={titleId}>
      {/* Phones only: the folded order. */}
      <Button
        variant="bare"
        className={styles.orderBar}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.orderBarLabel}>
          Your order · {prints} {prints === 1 ? 'print' : 'prints'}
          <CaretDown
            size={14}
            weight="light"
            aria-hidden
            className={c(styles.orderBarCaret, open && styles.orderBarCaretOpen)}
          />
        </span>
        <span className={styles.orderBarAmount}>
          {formatEuro(totals ? totals.totalCents : itemsCents)}
        </span>
      </Button>

      <div id={bodyId} className={c(styles.orderBody, open && styles.orderBodyOpen)}>
        <div className={styles.orderHead}>
          <h2 id={titleId} className={styles.orderTitle}>
            Your order
          </h2>
          <ArrowLink href="/cart" size="small">
            Edit cart
          </ArrowLink>
        </div>

        <ul className={styles.orderRows}>
          {items.map((item) => {
            const short = specShortLine(item.specsSummary)
            const error = errors?.[item.lineId]
            return (
              <li key={item.lineId} className={styles.orderRow}>
                <ProtectedImage
                  src={item.thumbnailUrl}
                  alt={item.title}
                  width={0}
                  height={0}
                  wrapperClassName={styles.orderThumb}
                  className={styles.orderThumbImage}
                />
                <div className={styles.orderText}>
                  <em className={styles.orderItemTitle}>{item.title}</em>
                  <span className={styles.orderArtist}>{item.artistName}</span>
                  <span className={styles.orderEdition}>{editionLabel(item)}</span>
                  {(short || item.quantity > 1) && (
                    <span className={styles.orderSpec}>
                      {short}
                      {short && item.quantity > 1 && ' · '}
                      {item.quantity > 1 && (
                        <span className={styles.nowrap}>Quantity {item.quantity}</span>
                      )}
                    </span>
                  )}
                  {error && <span className={styles.itemError}>{error}</span>}
                </div>
                <span className={styles.orderPrice}>
                  {formatEuro(lineTotal(item).lineItemCents)}
                </span>
              </li>
            )
          })}
        </ul>

        <dl className={styles.orderFigures}>
          <div className={styles.orderFigure}>
            <dt>Items</dt>
            <dd>{formatEuro(totals ? totals.itemsPreTaxCents : itemsCents)}</dd>
          </div>
          {totals ? (
            <>
              <div className={styles.orderFigure}>
                <dt>Shipping</dt>
                <dd>{formatEuro(totals.shippingCents)}</dd>
              </div>
              <div className={styles.orderFigure}>
                <dt>{vatLabel(totals.vatRate)}</dt>
                <dd>{formatEuro(totals.customerVatCents)}</dd>
              </div>
              <div className={c(styles.orderFigure, styles.orderTotal)}>
                <dt>Total</dt>
                <dd>{formatEuro(totals.totalCents)}</dd>
              </div>
            </>
          ) : (
            <div className={c(styles.orderFigure, styles.orderFigurePending)}>
              <dt>Shipping and VAT</dt>
              <dd>Calculated after the address</dd>
            </div>
          )}
        </dl>
      </div>
    </aside>
  )
}

/** The black 54 px caps button of the checkout (Continue to review / payment, Pay). */
export const CheckoutButton = ({ className, ...props }: ComponentProps<typeof Button>) => (
  <Button
    variant="primary"
    size="bigSquared"
    fullWidth
    {...props}
    className={c(styles.button, className)}
  />
)

/** A bare button drawn as the small arrow link ("← Back to review", "→ Change"). */
export const ArrowButton = ({
  icon,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, 'variant' | 'children' | 'className' | 'icon'> & {
  icon: ReactNode
  children: ReactNode
}) => (
  <Button variant="bare" {...props} className={styles.arrowButton}>
    {icon}
    <span>{children}</span>
  </Button>
)
