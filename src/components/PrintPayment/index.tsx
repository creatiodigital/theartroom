'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'

import { Icon } from '@/components/ui/Icon'
import Logo from '@/icons/logo.svg'
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

import { PaymentForm } from './PaymentForm'
import type { StashedPayment } from './types'

import styles from './PrintPayment.module.scss'

interface PrintPaymentProps {
  artwork: WizardArtwork
  config: PrintConfig
  country: string
}

// Stripe recommends loading the publishable key lazily and only once per
// page. Outside the component so it doesn't re-init on every render.
const stripePromise: Promise<Stripe | null> =
  typeof window === 'undefined'
    ? Promise.resolve(null)
    : loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
const countryName = (code: string) => regionNames?.of(code) ?? code

export const PrintPayment = ({ artwork, config, country }: PrintPaymentProps) => {
  const router = useRouter()
  const [stashed, setStashed] = useState<StashedPayment | null>(null)
  const [hydrating, setHydrating] = useState(true)

  // The checkout page populated sessionStorage with the clientSecret +
  // address + totals right before sending us here. If it's missing (deep
  // link, refresh, or the user cleared storage) we have nothing to pay
  // against, so bounce them back to the address step.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`print-payment:${artwork.slug}`)
      if (!raw) {
        bounceBackToCheckout()
        return
      }
      const parsed = JSON.parse(raw) as StashedPayment
      if (!parsed.clientSecret) {
        bounceBackToCheckout()
        return
      }
      setStashed(parsed)
    } catch {
      bounceBackToCheckout()
    } finally {
      setHydrating(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artwork.slug])

  const bounceBackToCheckout = () => {
    const params = new URLSearchParams({
      paper: config.paperId,
      format: config.formatId,
      size: config.sizeId,
      color: config.frameColorId,
      mount: config.mountId,
      country,
    })
    router.replace(`/artworks/${artwork.slug}/print/checkout?${params.toString()}`)
  }

  const paper = getPaper(config.paperId)
  const format = getFormat(config.formatId)
  const size = getSize(config.sizeId)
  const frameColor = getFrameColor(config.frameColorId)
  const mount = getMount(config.mountId)

  const elementsOptions = useMemo(() => {
    if (!stashed) return null
    return {
      clientSecret: stashed.clientSecret,
      appearance: { theme: 'stripe' as const },
    }
  }, [stashed])

  return (
    <div className={styles.payment}>
      <header className={styles.header}>
        <Logo className={styles.logo} />
        <span className={styles.headerTitle}>Payment</span>
        <button
          type="button"
          onClick={bounceBackToCheckout}
          className={styles.backButton}
          aria-label="Back to shipping details"
        >
          <Icon name="arrowLeft" size={16} />
          BACK
        </button>
      </header>

      <main className={styles.body}>
        <section className={styles.paymentPanel}>
          <h2 className={styles.sectionTitle}>Pay with card</h2>
          <p className={styles.sectionHelp}>
            All payments are processed securely by Stripe. Your card details never touch our
            servers. We&apos;ll hold your card now and charge it once your print enters production.
          </p>
          <p className={styles.sectionHelp}>
            By placing your order you agree to our{' '}
            <a href="/terms-of-sale" target="_blank" rel="noopener noreferrer">
              Online Terms of Sale
            </a>
            .
          </p>

          {hydrating && <p className={styles.hydrating}>Preparing secure payment…</p>}

          {!hydrating && stashed && elementsOptions && (
            <Elements stripe={stripePromise} options={elementsOptions}>
              <PaymentForm
                stashed={stashed}
                artworkSlug={artwork.slug}
                onBack={bounceBackToCheckout}
              />
            </Elements>
          )}
        </section>

        <aside className={styles.summaryPanel}>
          <div className={styles.summaryHeader}>
            {artwork.imageUrl && (
              <Image
                src={artwork.imageUrl}
                alt={artwork.title}
                width={72}
                height={72}
                className={styles.summaryThumb}
              />
            )}
            <div className={styles.summaryMeta}>
              <span className={styles.summaryEyebrow}>{artwork.artistName}</span>
              <h2 className={styles.summaryTitle}>{artwork.title}</h2>
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
              <span>{formatSize(size, 'cm')}</span>
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

          {stashed && (
            <>
              <div className={styles.destinationLine}>
                <span>Shipping to</span>
                <strong>{countryName(country)}</strong>
              </div>
              <div className={styles.totalRow}>
                <span>Total</span>
                <span className={styles.totalValue}>{formatEuro(stashed.totals.totalCents)}</span>
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
  )
}
