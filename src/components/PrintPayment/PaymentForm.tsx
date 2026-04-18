'use client'

import { useState } from 'react'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'

import { formatEuro } from '@/components/PrintWizard/options'

import type { StashedPayment } from './types'

import styles from './PrintPayment.module.scss'

interface PaymentFormProps {
  stashed: StashedPayment
  artworkSlug: string
  onBack: () => void
}

export const PaymentForm = ({ stashed, artworkSlug, onBack }: PaymentFormProps) => {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    const returnUrl = `${window.location.origin}/artworks/${artworkSlug}/print/confirmation`

    // confirmPayment either resolves with an error (validation, declined
    // card) or redirects away to Stripe's hosted flow for 3DS and then
    // comes back to return_url. On success with no redirect needed, it
    // also returns here with no error — but the user still gets pushed
    // to return_url automatically unless `redirect: 'if_required'` is
    // set. We let Stripe handle the redirect so we don't have to manage
    // the success-path state ourselves.
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
    }
    // On success Stripe redirects — we won't reach this line.
  }

  return (
    <form onSubmit={handleSubmit} className={styles.paymentForm}>
      <PaymentElement
        options={{
          layout: 'tabs',
          // Shipping address is already collected on the previous step —
          // tell Stripe not to re-ask. We'll attach it to the PaymentIntent
          // at creation time (in createPaymentIntent).
          fields: { billingDetails: { address: 'auto' } },
        }}
      />

      {error && <p className={styles.paymentError}>{error}</p>}

      <div className={styles.paymentActions}>
        <button
          type="button"
          onClick={onBack}
          className={styles.secondaryButton}
          disabled={submitting}
        >
          Back to shipping
        </button>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={!stripe || !elements || submitting}
        >
          {submitting ? 'Processing…' : `Pay ${formatEuro(stashed.totals.totalCents)}`}
        </button>
      </div>

      <p className={styles.smallprint}>
        You&apos;ll be charged once you click Pay. Test cards work here — try
        <code> 4242 4242 4242 4242</code> with any future expiry and any CVC.
      </p>
    </form>
  )
}
