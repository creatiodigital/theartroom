'use client'

import { useState } from 'react'
import Image from 'next/image'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import {
  formatEuro,
  formatSize,
  getFormat,
  getFrameColor,
  getMount,
  getPaper,
  getSize,
} from '@/components/PrintWizard/options'
import type { PrintConfig, WizardArtwork } from '@/components/PrintWizard/types'

import type { StashedPayment } from './types'

import styles from './PrintPayment.module.scss'

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
const countryName = (code: string) => regionNames?.of(code) ?? code

interface PaymentFormProps {
  stashed: StashedPayment
  artwork: WizardArtwork
  config: PrintConfig
  country: string
  artworkSlug: string
  onBack: () => void
}

// The `form` attribute on the sidebar's submit button points here so a click
// in the aside still submits the card form in the main panel.
const FORM_ID = 'print-payment-form'

export const PaymentForm = ({
  stashed,
  artwork,
  config,
  country,
  artworkSlug,
  onBack,
}: PaymentFormProps) => {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paper = getPaper(config.paperId)
  const format = getFormat(config.formatId)
  const size = getSize(config.sizeId)
  const frameColor = getFrameColor(config.frameColorId)
  const mount = getMount(config.mountId)

  const { totalCents, customerVatCents } = stashed.totals
  const subtotalCents = totalCents - customerVatCents
  const vatLabel =
    customerVatCents > 0 && subtotalCents > 0
      ? `VAT (${Math.round((customerVatCents * 100) / subtotalCents)}%)`
      : 'VAT'

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
    const addr = stashed.address
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        // We already collected these on step 2 — pass them explicitly so
        // the PaymentElement can hide its own address fields (the native
        // country <select> is a browser-default eyesore we can't style
        // inside Stripe's iframe).
        payment_method_data: {
          billing_details: {
            name: addr.fullName,
            email: addr.email || undefined,
            phone: addr.phone || undefined,
            address: {
              line1: addr.address1,
              line2: addr.address2 || undefined,
              city: addr.city,
              state: addr.stateOrRegion || undefined,
              postal_code: addr.postalCode,
              country: addr.countryCode,
            },
          },
        },
      },
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
    }
    // On success Stripe redirects — we won't reach this line.
  }

  return (
    <>
      <section className={styles.paymentPanel}>
        <h2 className={styles.sectionTitle}>Pay with card</h2>
        <p className={styles.sectionHelp}>
          All payments are processed securely by Stripe. Your card details never touch our servers.
          We&apos;ll hold your card now and charge it once your print enters production.
        </p>
        <p className={styles.sectionHelp}>
          By placing your order you agree to our{' '}
          <a href="/terms-of-sale" target="_blank" rel="noopener noreferrer">
            Online Terms of Sale
          </a>
          .
        </p>

        <form id={FORM_ID} onSubmit={handleSubmit} className={styles.paymentForm}>
          <PaymentElement
            options={{
              layout: 'tabs',
              // We collected name/email/phone/address on the checkout step
              // and pass them to Stripe via payment_method_data in
              // confirmPayment. 'never' hides the fields Stripe would
              // otherwise render — including the native country <select>
              // inside its iframe, which we can't style.
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

        <div className={styles.backRow}>
          <Button
            variant="secondary"
            size="big"
            label="Back to shipping"
            iconLeft={<Icon name="arrowLeft" size={20} />}
            onClick={onBack}
            disabled={submitting}
          />
        </div>
      </section>

      <aside className={styles.summaryPanel}>
        <div className={styles.summaryHeader}>
          {artwork.imageUrl && (
            <Image
              src={artwork.imageUrl}
              alt={artwork.title}
              width={72}
              height={72}
              className={`${styles.summaryThumb}${
                (config.orientation === 'landscape') !==
                artwork.originalWidthPx >= artwork.originalHeightPx
                  ? ` ${styles.summaryThumbRotated}`
                  : ''
              }`}
            />
          )}
          <div className={styles.summaryMeta}>
            <span className={styles.summaryEyebrow}>{artwork.artistName}</span>
            <h2 className={styles.summaryTitle}>{artwork.title}</h2>
            {artwork.year && <span className={styles.summaryYear}>{artwork.year}</span>}
          </div>
        </div>

        <ul className={styles.specList}>
          <li>
            <span>Paper</span>
            <span>{paper.label}</span>
          </li>
          <li>
            <span>Format</span>
            <span>{format.label}</span>
          </li>
          <li>
            <span>Size</span>
            <span>{formatSize(size, config.orientation)}</span>
          </li>
          {format.framed && (
            <>
              <li>
                <span>Frame</span>
                <span>{frameColor.label}</span>
              </li>
              <li>
                <span>Mount</span>
                <span>{mount.label}</span>
              </li>
            </>
          )}
        </ul>

        <div className={styles.destinationLine}>
          <span>Shipping to</span>
          <strong>{countryName(country)}</strong>
        </div>
        <div className={styles.priceRow}>
          <span>Subtotal</span>
          <span>{formatEuro(subtotalCents)}</span>
        </div>
        <div className={styles.priceRow}>
          <span>{vatLabel}</span>
          <span>{formatEuro(customerVatCents)}</span>
        </div>
        <div className={styles.totalRow}>
          <span>Total</span>
          <span className={styles.totalValue}>{formatEuro(totalCents)}</span>
        </div>

        <button
          type="submit"
          form={FORM_ID}
          className={styles.ctaButton}
          disabled={!stripe || !elements || submitting}
        >
          {submitting ? 'Processing…' : `Pay ${formatEuro(totalCents)}`}
        </button>
      </aside>
    </>
  )
}
