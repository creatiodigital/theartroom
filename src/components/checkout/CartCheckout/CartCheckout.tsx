'use client'

import { useEffect, useRef, useState } from 'react'

import { ArrowRight } from '@phosphor-icons/react'

import { AddressForm } from '@/components/checkout/AddressForm'
import {
  ArrowButton,
  CheckoutAside,
  CheckoutButton,
  ItemsTotal,
  OrderItems,
  StepIndicator,
  Totals,
} from '@/components/checkout/CheckoutParts'
import { CartItemDetails } from '@/components/cart/CartItemDetails/CartItemDetails'
import { EmptyCart } from '@/components/cart/EmptyCart'
import { ArrowLink } from '@/components/ui/ArrowLink'
import { PageIntro } from '@/components/ui/PageIntro'
import { PageLayout } from '@/components/ui/PageLayout'
import { cartSubtotal, lineTotal } from '@/lib/cart/cartMath'
import type { CartItem } from '@/lib/cart/types'
import { useCart } from '@/lib/cart/useCart'
import type { CartLikeItem, CartTotals } from '@/lib/cart/validateCart'
import { formatEuro } from '@/lib/print-providers'
import { getCountryName } from '@/lib/print-providers/dialCodes'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'

import { CartConfirmation, type PlacedOrderSummary } from './CartConfirmation'
import { CartPayment } from './CartPayment'
import { createCartPaymentIntent } from './createCartPaymentIntent'
import { validateCartAction } from './validateCartAction'
import { verifyCartPaymentAction } from './verifyCartPaymentAction'

import styles from './CartCheckout.module.scss'

// Map a cart line to the minimal shape the server action needs. The server
// re-prices everything from the live catalog, so the display-snapshot cents
// are deliberately NOT sent.
const toCartLikeItem = (item: CartItem): CartLikeItem => ({
  lineId: item.lineId,
  artworkSlug: item.artworkSlug,
  providerId: item.providerId,
  config: item.config,
  variantId: item.variantId,
  editionType: item.editionType,
  quantity: item.quantity,
})

type Step = 'address' | 'review' | 'payment' | 'confirmation'

type CartCheckoutProps = {
  /** Provider-shippable countries — restricts the address country picker so a
   *  buyer can't choose a destination the server-side validation will reject. */
  supportedCountries: string[]
  /** Whether address autocomplete is configured. Decided on the server — the
   *  Maps key never reaches the browser. */
  addressAutocomplete?: boolean
}

/**
 * Rewrite /checkout to carry ONLY the PaymentIntent id.
 *
 * The id is what lets a reload rebuild the confirmation. Stripe's redirect also
 * appends `payment_intent_client_secret` and `redirect_status`; the client
 * secret can confirm the PaymentIntent, so it has no business sitting in a URL
 * the buyer may bookmark, copy to us or paste into a support chat. It is
 * dropped here rather than merely ignored.
 */
function keepOnlyPaymentIntentInUrl(paymentIntentId: string): void {
  window.history.replaceState(
    null,
    '',
    `/checkout?payment_intent=${encodeURIComponent(paymentIntentId)}`,
  )
}

export const CartCheckout = ({
  supportedCountries,
  addressAutocomplete = false,
}: CartCheckoutProps) => {
  const { items, clear, removeItem } = useCart()

  // Becomes true the moment payment is authorized (no-redirect path) or a 3DS
  // return is verified. Suppresses the empty-cart view after clear() empties
  // the cart, so the confirmation step renders instead.
  const paidRef = useRef(false)
  const [step, setStep] = useState<Step>('address')
  const [address, setAddress] = useState<ShippingAddress | null>(null)
  const [totals, setTotals] = useState<CartTotals | null>(null)
  // Set once createCartPaymentIntent succeeds; drives the Stripe Elements
  // mount on the payment step.
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Order-level error (e.g. empty cart, ceiling). Per-line failures are kept
  // separately so we can attach the message to the offending line.
  const [orderError, setOrderError] = useState<string | null>(null)
  // lineId → "no longer available" style message, surfaced on the line.
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})
  const [payError, setPayError] = useState<string | null>(null)
  // Display only: the lines as they were when payment went through in place, for the
  // confirmation's "Your order" panel (the cart is cleared right after). Not set on a redirect
  // return or a reload (Q-P15).
  const [placedItems, setPlacedItems] = useState<CartItem[] | null>(null)

  // Redirect return path. Stripe sends the buyer back to return_url
  // (/checkout) with ?payment_intent=... — after 3DS on a card, and ALWAYS for
  // a redirect-based method like PayPal. Verify it server-side (never trust
  // redirect_status), then clear the cart and land on the confirmation step.
  //
  // This is also the reload path: the id stays in the URL precisely so a
  // refresh re-enters here and rebuilds the confirmation. Re-entry is
  // idempotent — the PI is re-read from Stripe, the order is fetched (or
  // created) by reference, and clear() no-ops on an emptied cart.
  const handledReturnRef = useRef(false)
  // True from the first render after mount when the URL names a PaymentIntent,
  // so the empty-cart view below yields while we verify. The cart IS empty on a
  // reload — it was cleared when the order was placed — and showing "your cart
  // is empty" over a completed order is exactly the bug this path fixes.
  const [restoringOrder, setRestoringOrder] = useState(false)
  useEffect(() => {
    if (handledReturnRef.current) return
    handledReturnRef.current = true
    const params = new URLSearchParams(window.location.search)
    const returnedPi = params.get('payment_intent')
    if (!returnedPi) return
    setRestoringOrder(true)
    void (async () => {
      const result = await verifyCartPaymentAction(returnedPi)
      if (!result.ok) {
        // Auth failed / unknown PI — drop the buyer back to the address step
        // with a retry message rather than a false success.
        setRestoringOrder(false)
        setPayError('Payment could not be completed. Please try again.')
        window.history.replaceState(null, '', '/checkout')
        return
      }
      paidRef.current = true
      setPaymentIntentId(result.paymentIntentId)
      setStep('confirmation')
      setRestoringOrder(false)
      await clear()
      keepOnlyPaymentIntentInUrl(result.paymentIntentId)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After a successful payment the cart is emptied — but we must keep showing
  // the confirmation, not the "empty cart" view. paidRef gates that, and
  // restoringOrder covers the reload, where paidRef starts false again.
  if (items.length === 0 && !paidRef.current && !restoringOrder) {
    return (
      <PageLayout>
        <div className={styles.page}>
          <PageIntro title="Checkout" compact />
          <EmptyCart />
        </div>
      </PageLayout>
    )
  }

  const handleAddressSubmit = async (submitted: ShippingAddress) => {
    setSubmitting(true)
    setOrderError(null)
    setLineErrors({})
    setPayError(null)
    try {
      const result = await validateCartAction(items.map(toCartLikeItem), submitted)
      if (!result.ok) {
        // Split failures into per-line (attach to the line) and order-level
        // (empty lineId, e.g. the total ceiling) so the buyer sees exactly
        // which item is the problem.
        const byLine: Record<string, string> = {}
        let order: string | null = null
        for (const f of result.failures) {
          if (f.lineId) byLine[f.lineId] = f.error
          else order = f.error
        }
        setLineErrors(byLine)
        setOrderError(order)
        // Stay on the address step with the cart context visible so the
        // buyer can fix/remove the offending line; do NOT advance.
        return
      }
      setAddress(submitted)
      setTotals(result.totals)
      setStep('review')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChangeAddress = () => {
    setStep('address')
    setTotals(null)
    setPayError(null)
    // Discard any PI created for the old address. A later proceed re-runs
    // createCartPaymentIntent — identical inputs return the same PI
    // (idempotent), different inputs mint a new one; the abandoned PI's auth
    // expires/cancels via Stripe.
    setClientSecret(null)
    setPaymentIntentId(null)
  }

  // Return from the payment step to the review step without discarding the PI
  // (the same clientSecret remounts on a re-proceed). "Change address" is the
  // path that resets the PI.
  const handleBackToReview = () => {
    setStep('review')
    setPayError(null)
  }

  const handleProceedToPayment = async () => {
    if (!address) return
    setSubmitting(true)
    setPayError(null)
    try {
      const result = await createCartPaymentIntent({
        // Nothing is held client-side: the PI call claims every limited
        // number itself, atomically, and is the first and only moment stock
        // is decided.
        items: items.map(toCartLikeItem),
        address,
      })
      if (!result.ok) {
        // Sold-out / validation failure: surface inline and send the buyer
        // back to the address step where the per-line cart context shows
        // which item is the problem.
        // Sold out mid-checkout: drop exactly that line and let the buyer
        // continue with the rest. The message names the edition, so the cart
        // changing under them is explained rather than mysterious.
        if (result.soldOutLineId) await removeItem(result.soldOutLineId)
        setPayError(result.error)
        setStep('address')
        return
      }
      setClientSecret(result.clientSecret)
      setPaymentIntentId(result.paymentIntentId)
      setTotals(result.totals)
      setStep('payment')
    } catch {
      setPayError('Payment is not available right now. Please try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  // Card authorized (manual capture → requires_capture). Mark paid BEFORE
  // clearing so the empty-cart guard yields to the confirmation step, then
  // clear the cart. clear() releases only still-unattached holds; this cart's
  // numbers now carry the PI, so releaseCartHolds no-ops on them — correct.
  const handlePaymentSuccess = (confirmedPaymentIntentId: string) => {
    paidRef.current = true
    setPaymentIntentId(confirmedPaymentIntentId)
    setStep('confirmation')
    void clear()
    // Same URL contract as the redirect path, so a reload rebuilds the
    // confirmation here too. Without it this branch — a card needing no 3DS —
    // held the order only in memory, and one refresh lost the reference.
    keepOnlyPaymentIntentInUrl(confirmedPaymentIntentId)
  }

  // The confirmation has a layout of its own (order-confirmed.dc.html): no title, no steps.
  if (step === 'confirmation') {
    return (
      <PageLayout>
        <div className={styles.page}>
          {paymentIntentId && (
            <CartConfirmation
              paymentIntentId={paymentIntentId}
              summary={summaryForConfirmation(placedItems, totals, address)}
            />
          )}
        </div>
      </PageLayout>
    )
  }

  // Order errors on the shipping step: what the server refused, and payment-side failures that
  // route the buyer back here (sold out at the PI call, or a failed 3DS return).
  const hasLineErrors = Object.keys(lineErrors).length > 0
  const addressErrors = (orderError || hasLineErrors || payError) && (
    <div className={styles.errors}>
      {orderError && <p className={styles.orderError}>{orderError}</p>}
      {hasLineErrors && (
        <p className={styles.orderError}>
          Some items in your order are no longer available. Please update your cart and try again.
        </p>
      )}
      {payError && <p className={styles.orderError}>{payError}</p>}
    </div>
  )

  return (
    <PageLayout>
      <div className={styles.page}>
        <PageIntro title="Checkout" compact />
        <StepIndicator current={step === 'address' ? 0 : step === 'review' ? 1 : 2} />

        {step === 'address' && (
          <div className={styles.grid}>
            <div className={styles.main}>
              {addressErrors}
              <AddressForm
                onSubmit={handleAddressSubmit}
                submitting={submitting}
                submitLabel="Continue to review"
                countryCodes={supportedCountries}
                initialAddress={address}
                addressAutocomplete={addressAutocomplete}
              />
            </div>

            <CheckoutAside title="Your order">
              <OrderItems items={items} errors={lineErrors} />
              {/* The cart's own figures until the address is known; the server re-prices on the
                  next step. */}
              <ItemsTotal itemsCents={cartSubtotal(items)} />
              <ArrowLink href="/cart" size="small" className={styles.asideLink}>
                Edit cart
              </ArrowLink>
            </CheckoutAside>
          </div>
        )}

        {step === 'review' && totals && address && (
          <div className={styles.grid}>
            <div className={styles.main}>
              <h2 className={styles.stepTitle}>Check your order</h2>

              <div className={styles.shipTo}>
                <div className={styles.shipToText}>
                  <span className={styles.shipToLabel}>Shipping to</span>
                  <span className={styles.shipToName}>{address.fullName}</span>
                  <span className={styles.shipToAddress}>
                    {[
                      address.address1,
                      address.address2,
                      `${address.postalCode} ${address.city}`.trim(),
                      address.stateOrRegion,
                    ]
                      .filter(Boolean)
                      .join(', ')}{' '}
                    · {getCountryName(address.countryCode)}
                  </span>
                  <span className={styles.shipToContact}>
                    {[address.email, address.phone].filter(Boolean).map((part, index) => (
                      <span key={part} className={styles.nowrap}>
                        {index > 0 && ' · '}
                        {part}
                      </span>
                    ))}
                  </span>
                </div>
                {/* The hidden word keeps the button's name "Change address". */}
                <ArrowButton
                  icon={<ArrowRight size={15} weight="light" aria-hidden />}
                  onClick={handleChangeAddress}
                >
                  Change<span className="sr-only"> address</span>
                </ArrowButton>
              </div>

              <div>
                {items.map((item) => (
                  <CheckoutLine key={item.lineId} item={item} />
                ))}
              </div>

              <ArrowLink href="/cart" size="small">
                Edit cart
              </ArrowLink>
            </div>

            <CheckoutAside title="Summary">
              <Totals totals={totals} />
              {payError && <p className={styles.orderError}>{payError}</p>}
              <CheckoutButton
                disabled={submitting}
                label={submitting ? 'Preparing payment…' : 'Continue to payment'}
                onClick={() => {
                  void handleProceedToPayment()
                }}
                className={styles.asideButton}
              />
            </CheckoutAside>
          </div>
        )}

        {step === 'payment' && totals && address && clientSecret && (
          <CartPayment
            clientSecret={clientSecret}
            items={items}
            totals={totals}
            address={address}
            onSuccess={(confirmedPaymentIntentId) => {
              setPlacedItems(items)
              handlePaymentSuccess(confirmedPaymentIntentId)
            }}
            onBack={handleBackToReview}
          />
        )}
      </div>
    </PageLayout>
  )
}

function summaryForConfirmation(
  items: CartItem[] | null,
  totals: CartTotals | null,
  address: ShippingAddress | null,
): PlacedOrderSummary | null {
  return items && items.length > 0 && totals && address ? { items, totals, address } : null
}

type CheckoutLineProps = {
  item: CartItem
  /** Per-line "no longer available" message from the server revalidation. */
  error?: string
}

/**
 * Read-only order line for the review step (checkout-2-review.dc.html): the cart's item block with
 * the price on the right. No steppers or remove controls — the buyer edits quantities on the cart
 * page; checkout just reflects the order.
 */
const CheckoutLine = ({ item, error }: CheckoutLineProps) => {
  const { lineItemCents } = lineTotal(item)
  return (
    <div className={styles.line}>
      <CartItemDetails
        item={item}
        error={error}
        aside={
          <span className={styles.linePrice}>
            {formatEuro(lineItemCents)}
            {item.quantity > 1 && <span className={styles.lineQty}>Quantity {item.quantity}</span>}
          </span>
        }
      />
    </div>
  )
}
