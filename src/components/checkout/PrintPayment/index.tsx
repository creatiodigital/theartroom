'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'

import Logo from '@/icons/logo.svg'
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
      orientation: config.orientation,
      country,
    })
    router.replace(`/artworks/${artwork.slug}/print/checkout?${params.toString()}`)
  }

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
        <Link href="/" aria-label="Go to home" className={styles.logoLink}>
          <Logo className={styles.logo} />
        </Link>
        <span className={styles.headerTitle}>Payment</span>
      </header>

      <main className={styles.body}>
        {hydrating && <p className={styles.hydrating}>Preparing secure payment…</p>}

        {!hydrating && stashed && elementsOptions && (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <PaymentForm
              stashed={stashed}
              artwork={artwork}
              config={config}
              country={country}
              artworkSlug={artwork.slug}
              onBack={bounceBackToCheckout}
            />
          </Elements>
        )}
      </main>
    </div>
  )
}
