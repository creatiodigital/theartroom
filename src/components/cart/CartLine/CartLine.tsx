'use client'

import { useState } from 'react'
import { Minus, Plus, Trash } from '@phosphor-icons/react'

import { CartItemDetails } from '@/components/cart/CartItemDetails/CartItemDetails'
import { configToWizardParams } from '@/components/PrintWizard/wizardParams'
import { ArrowLink } from '@/components/ui/ArrowLink'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal/ConfirmModal'
import { useCart } from '@/lib/cart/useCart'
import { lineTotal } from '@/lib/cart/cartMath'
import type { CartItem } from '@/lib/cart/types'
import { formatEuro } from '@/lib/print-providers'

import styles from './CartLine.module.scss'

interface CartLineProps {
  item: CartItem
}

export const CartLine = ({ item }: CartLineProps) => {
  const { setQuantity, removeItem } = useCart()
  const { lineItemCents } = lineTotal(item)

  // Limited editions are capped at a single copy per order: one buy → one
  // edition number, so an order never carries two or three numbers that are
  // hard to track. A buyer who wants another copy pays again. The '+' is
  // disabled for limited lines; open editions step freely.
  const isLimited = item.editionType === 'limited'

  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const increase = async () => {
    await setQuantity(item.lineId, item.quantity + 1)
  }

  const decrease = async () => {
    // At the floor, "−" means remove: confirm first (same modal as Remove)
    // rather than silently dropping the line to a 0-quantity state.
    if (item.quantity <= 1) {
      setConfirmingRemove(true)
      return
    }
    await setQuantity(item.lineId, item.quantity - 1)
  }

  // "Edit" re-opens the wizard pre-filled with this line's selection. The
  // lineId rides along so the wizard replaces this line on re-add (rather than
  // leaving a duplicate). Encoding shared with the checkout "back to wizard".
  const editParams = configToWizardParams(item.config)
  editParams.set('editLineId', item.lineId)
  // Limited editions re-open the variant-picker wizard, which restores the
  // chosen edition from this param (the config params don't carry the variant).
  if (item.variantId) editParams.set('variant', item.variantId)
  const editHref = `/artworks/${item.artworkSlug}/print?${editParams.toString()}`

  return (
    <div className={styles.line}>
      <CartItemDetails
        item={item}
        actions={
          <>
            {/* Open editions only. A limited line has nothing to edit — the
                variant IS the object, not a configuration of it, and the wizard
                it led to could only ever offer "Go to cart" or add a second
                line. A link labelled Edit that cannot edit is worse than none.
                The hidden word keeps the link's name "Edit item". */}
            {!isLimited && (
              <ArrowLink href={editHref} size="small" className={styles.edit}>
                Edit<span className="sr-only"> item</span>
              </ArrowLink>
            )}
            <Button
              variant="bare"
              className={styles.remove}
              onClick={() => setConfirmingRemove(true)}
            >
              <Trash size={15} weight="light" aria-hidden />
              <span>
                Remove<span className="sr-only"> from cart</span>
              </span>
            </Button>
          </>
        }
        aside={
          <>
            <span className={styles.price}>{formatEuro(lineItemCents)}</span>
            <div className={styles.quantity}>
              <div className={styles.stepper}>
                <Button
                  variant="bare"
                  className={styles.step}
                  aria-label={item.quantity <= 1 ? 'Remove item' : 'Decrease quantity'}
                  onClick={decrease}
                >
                  <Minus size={14} weight="light" aria-hidden />
                </Button>
                <span className={styles.qty} aria-live="polite">
                  {item.quantity}
                </span>
                <Button
                  variant="bare"
                  className={styles.step}
                  aria-label="Increase quantity"
                  disabled={isLimited}
                  onClick={increase}
                >
                  <Plus size={14} weight="light" aria-hidden />
                </Button>
              </div>
              {isLimited && <span className={styles.limitNote}>One per limited edition</span>}
            </div>
          </>
        }
      />

      {confirmingRemove && (
        <ConfirmModal
          title="Remove print?"
          message={`Remove “${item.title}” from your cart?`}
          confirmLabel="Remove"
          destructive
          onConfirm={() => {
            removeItem(item.lineId)
            setConfirmingRemove(false)
          }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </div>
  )
}
