'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Lock } from '@phosphor-icons/react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'

import {
  ArrowButton,
  CheckoutAside,
  CheckoutButton,
  OrderItems,
  Totals,
} from '@/components/checkout/CheckoutParts'
import type { CartItem } from '@/lib/cart/types'
import type { CartTotals } from '@/lib/cart/validateCart'
import { STRIPE_APPEARANCE } from '@/lib/checkout/stripeAppearance'
import { formatEuro } from '@/lib/print-providers'
import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'

import styles from './CartPayment.module.scss'

// Stripe recommends loading the publishable key lazily and only once per
// page. Outside the component so it doesn't re-init on every render. Mirrors
// PrintPayment's setup exactly — the cart reuses the same Stripe Elements UI.
const stripePromise: Promise<Stripe | null> =
  typeof window === 'undefined'
    ? Promise.resolve(null)
    : loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

type CartPaymentProps = {
  clientSecret: string
  /** The cart's lines, for the order panel. */
  items: CartItem[]
  totals: CartTotals
  address: ShippingAddress
  /** Card authorized (manual capture). The parent clears the cart + shows
   *  the confirmation step. */
  onSuccess: (paymentIntentId: string) => void
  /** Return to the review step (e.g. "Back to review"). */
  onBack: () => void
}

/**
 * Cart payment view. Mounts the SAME Stripe Elements UI the single-print
 * PrintPayment uses (squared appearance, PaymentElement with billing
 * fields:'never', explicit billing_details on confirm). Built cart-specific
 * rather than reusing PrintPayment because that component is route- and
 * sessionStorage-coupled to a single artwork; the cart is an in-component
 * step machine over multiple line items.
 */
export const CartPayment = ({
  clientSecret,
  items,
  totals,
  address,
  onSuccess,
  onBack,
}: CartPaymentProps) => {
  const elementsOptions = useMemo(
    () => ({
      clientSecret,
      // Square, in the checkout's style (Q-P6); look only.
      appearance: STRIPE_APPEARANCE,
    }),
    [clientSecret],
  )

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      <CartPaymentForm
        items={items}
        totals={totals}
        address={address}
        onSuccess={onSuccess}
        onBack={onBack}
      />
    </Elements>
  )
}

type CartPaymentFormProps = {
  items: CartItem[]
  totals: CartTotals
  address: ShippingAddress
  onSuccess: (paymentIntentId: string) => void
  onBack: () => void
}

const CartPaymentForm = ({ items, totals, address, onSuccess, onBack }: CartPaymentFormProps) => {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    // `redirect: 'if_required'` keeps the success path inside this
    // in-component step machine (no route round-trip): on a no-redirect
    // auth we read the PaymentIntent back here and advance to the
    // confirmation step ourselves. Stripe only redirects to return_url when
    // the card needs 3DS — return_url lands back on /checkout, where the
    // parent re-hydrates the PI from the querystring and verifies it
    // server-side.
    const returnUrl = `${window.location.origin}/checkout`
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        // We collected name/email/phone/address on the address step — pass
        // them explicitly so the PaymentElement can hide its own fields
        // (the native country <select> is a browser-default eyesore we
        // can't style inside Stripe's iframe). Use '' (not undefined) for
        // optional/unfilled fields — without this, EU buyers who skip
        // "State / region" hit a silent confirmPayment hang.
        payment_method_data: {
          billing_details: {
            name: address.fullName,
            email: address.email,
            phone: address.phone,
            address: {
              line1: address.address1,
              line2: address.address2,
              city: address.city,
              state: address.stateOrRegion,
              postal_code: address.postalCode,
              country: address.countryCode,
            },
          },
        },
      },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
      return
    }

    // No redirect was required. With manual capture a successful authorization
    // lands the PI in `requires_capture`; treat that (and the rare immediate
    // `succeeded`) as done from the buyer's perspective.
    if (
      paymentIntent &&
      (paymentIntent.status === 'requires_capture' ||
        paymentIntent.status === 'succeeded' ||
        paymentIntent.status === 'processing')
    ) {
      onSuccess(paymentIntent.id)
      return
    }

    // Any other terminal state (e.g. requires_payment_method after a soft
    // decline) — surface a retry message and keep the buyer on this step.
    setError('Payment could not be completed. Please try again.')
    setSubmitting(false)
  }

  return (
    <div className={styles.paymentStep}>
      <div className={styles.paymentMain}>
        <h2 className={styles.paymentTitle}>Payment</h2>

        <form id="cart-payment-form" onSubmit={handleSubmit} className={styles.paymentForm}>
          <PaymentElement
            options={{
              layout: 'tabs',
              fields: {
                billingDetails: {
                  name: 'never',
                  email: 'never',
                  phone: 'never',
                  address: 'never',
                },
              },
            }}
          />
          {error && <p className={styles.paymentError}>{error}</p>}
        </form>

        <p className={styles.paymentHelp}>
          <Lock size={16} weight="light" aria-hidden className={styles.helpIcon} />
          <span>
            All payments are processed securely by Stripe. Your card details never touch our
            servers. We&apos;ll hold your card now and charge it once your order enters production.
          </span>
        </p>

        {/* Under the form on purpose: the panel holds only what the buyer needs to complete
            payment; navigation back sits apart from it. */}
        <ArrowButton
          icon={<ArrowLeft size={15} weight="light" aria-hidden />}
          onClick={onBack}
          disabled={submitting}
        >
          Back to review
        </ArrowButton>
      </div>

      <CheckoutAside title="Summary" className={styles.aside}>
        <OrderItems items={items} />
        <Totals totals={totals} />
        <CheckoutButton
          type="submit"
          form="cart-payment-form"
          disabled={!stripe || !elements || submitting}
          label={submitting ? 'Processing…' : `Pay ${formatEuro(totals.totalCents)}`}
          iconLeft={<Lock size={16} weight="light" aria-hidden />}
          className={styles.payButton}
        />
        <p className={styles.terms}>
          By placing your order you agree to our{' '}
          <a href="/terms-of-sale" target="_blank" rel="noopener noreferrer">
            Online terms of sale
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </p>
      </CheckoutAside>
    </div>
  )
}
