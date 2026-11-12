'use client'

import { Lock } from '@phosphor-icons/react'

import { CartLine } from '@/components/cart/CartLine'
import { ArrowLink } from '@/components/ui/ArrowLink'
import { Button } from '@/components/ui/Button'
import { PageIntro } from '@/components/ui/PageIntro'
import { PageLayout } from '@/components/ui/PageLayout'
import { cartCount, cartSubtotal, hasLimitedItems } from '@/lib/cart/cartMath'
import { LIMITED_NOT_RESERVED_NOTICE } from '@/lib/cart/notices'
import { useCart } from '@/lib/cart/useCart'
import { formatEuro } from '@/lib/print-providers'

import styles from './CartPage.module.scss'

export const CartPage = () => {
  const { items } = useCart()

  // Nothing in this cart is reserved. A limited edition can sell out while it
  // sits here, so say so once — plainly, with no clock and no countdown.
  const hasLimited = hasLimitedItems(items)

  if (items.length === 0) {
    return (
      <PageLayout>
        <div className={styles.page}>
          <PageIntro title="Cart" compact />
          {/* docs/public-redesign/other-screens.md "Empty cart". */}
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Your cart is empty.</p>
            <p className={styles.emptyLine}>
              Every print is made to order on archival fine-art paper and arrives with a Certificate
              of Authenticity.
            </p>
            <div className={styles.emptyLinks}>
              <ArrowLink href="/prints">Browse the prints</ArrowLink>
              <ArrowLink href="/exhibitions">Visit the exhibitions</ArrowLink>
            </div>
          </div>
        </div>
      </PageLayout>
    )
  }

  // Item prices only — shipping and VAT are added later at checkout.
  const subtotalCents = cartSubtotal(items)
  const prints = cartCount(items)

  return (
    <PageLayout>
      <div className={styles.page}>
        <PageIntro title="Cart" compact />

        <div className={styles.cartGrid}>
          <div className={styles.items}>
            <div className={styles.list}>
              {items.map((item) => (
                <CartLine key={item.lineId} item={item} />
              ))}
            </div>
            {/* Back to the wizard's first screen for the work they last added —
                the variant picker — because that is where another edition of it
                gets chosen. Deliberately NOT the browser's history and NOT the
                catalogue: the useful destination after looking at your cart is
                the list of editions you were just choosing from. No editLineId
                and no variant param, so it opens clean rather than resuming a
                line that is already in the cart. */}
            <div className={styles.backRow}>
              <ArrowLink
                icon="back"
                size="small"
                href={`/artworks/${items[items.length - 1].artworkSlug}/print`}
              >
                Back to editions
              </ArrowLink>
            </div>
          </div>

          <aside className={styles.summary} aria-labelledby="cart-summary-title">
            <h2 id="cart-summary-title" className={styles.summaryTitle}>
              Order summary
            </h2>
            <div className={styles.subtotalRow}>
              <span className={styles.subtotalLabel}>
                Subtotal · {prints} {prints === 1 ? 'print' : 'prints'}
              </span>
              <span className={styles.subtotalValue}>{formatEuro(subtotalCents)}</span>
            </div>
            <p className={styles.note}>Shipping and taxes are calculated at checkout.</p>
            <Button
              variant="primary"
              size="bigSquared"
              fullWidth
              href="/checkout"
              label="Continue to checkout"
              className={styles.checkoutButton}
            />
            <ArrowLink href="/prints" size="small" className={styles.browse}>
              Continue browsing
            </ArrowLink>
            {/* The stake stated in the panel, with the lock the design gives it. */}
            {hasLimited && (
              <p className={styles.limitedNotice}>
                <Lock size={14} weight="light" aria-hidden className={styles.lock} />
                <span>{LIMITED_NOT_RESERVED_NOTICE}</span>
              </p>
            )}
          </aside>
        </div>
      </div>
    </PageLayout>
  )
}
