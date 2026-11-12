'use client'

import type { ComponentProps, ReactNode } from 'react'
import { useId } from 'react'
import c from 'classnames'
import { Check } from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'
import { lineTotal } from '@/lib/cart/cartMath'
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

const STEPS = ['Shipping', 'Review', 'Payment'] as const

/** Shipping → Review → Payment; a done step gets a check. */
export const StepIndicator = ({ current }: { current: 0 | 1 | 2 }) => (
  <ol className={styles.steps} aria-label="Checkout steps">
    {STEPS.map((label, index) => (
      <li
        key={label}
        className={c(
          styles.step,
          index < current && styles.stepDone,
          index === current && styles.stepCurrent,
        )}
        aria-current={index === current ? 'step' : undefined}
      >
        <span className={styles.stepMark} aria-hidden>
          {index < current ? <Check size={12} weight="bold" /> : index + 1}
        </span>
        <span>
          {label}
          {index < current && <span className="sr-only"> (done)</span>}
        </span>
      </li>
    ))}
  </ol>
)

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
  totals: CartTotals
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

/** Before the address is known: the items' sum, and shipping and VAT left for the next step. */
export const ItemsTotal = ({ itemsCents }: { itemsCents: number }) => (
  <dl className={styles.totals}>
    <div className={styles.totalRow}>
      <dt>Items</dt>
      <dd>{formatEuro(itemsCents)}</dd>
    </div>
    <div className={c(styles.totalRow, styles.totalPending)}>
      <dt>Shipping and VAT</dt>
      <dd>Next step</dd>
    </div>
  </dl>
)

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
