'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import Logo from '@/icons/logo.svg'
import {
  type ProviderId,
  type Quote,
  type SpecsSummary,
  type WizardConfig,
  formatEuro,
} from '@/lib/print-providers'
import { getProviderQuote } from '@/lib/print-providers/quote'

import { OrderSummary } from '../OrderSummary'
import { clearPrintSession } from '../clearPrintSession'

import { createPaymentIntent } from './createPaymentIntent'

import styles from './PrintCheckout.module.scss'

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
const countryName = (code: string) => regionNames?.of(code) ?? code

export type CheckoutArtwork = {
  slug: string
  title: string
  artistName: string
  year?: string
  imageUrl: string
  originalWidthPx: number
  originalHeightPx: number
  printPriceCents: number
}

interface PrintCheckoutProps {
  artwork: CheckoutArtwork
  /** Server-authoritative provider for this artwork — used to dispatch
   *  quote calls and the server-side payment intent. */
  providerId: ProviderId
  /** ISO country code the wizard validated. */
  country: string
}

type AddressForm = {
  fullName: string
  email: string
  phone: string
  countryCode: string
  address1: string
  address2: string
  city: string
  stateOrRegion: string
  postalCode: string
}

/** Shape of the wizard → checkout/payment handoff stash. */
type WizardHandoff = {
  providerId: ProviderId
  config: WizardConfig
  country: string
  quote: Quote
  specs: SpecsSummary
}

export const PrintCheckout = ({ artwork, providerId, country }: PrintCheckoutProps) => {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [handoff, setHandoff] = useState<WizardHandoff | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Form validity is tracked separately because inputs are uncontrolled
  // (so Chrome autofill works without React re-renders clobbering values).
  // We poll the native HTML5 validity on every form input event.
  const [formValid, setFormValid] = useState(false)

  // Per-field "touched" state drives whether we show inline red error text
  // under each field. Keeps empty fields from flashing red on page load.
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Persist the shipping form to sessionStorage so navigating back to the
  // wizard and returning doesn't wipe out what the user (or Chrome
  // autofill) already typed. Keyed by artwork slug so different items
  // don't collide.
  const storageKey = `print-address:${artwork.slug}`

  const handleFormInput = () => {
    const form = formRef.current
    if (!form) return
    setFormValid(form.checkValidity())
    try {
      const fd = new FormData(form)
      const snapshot: Record<string, string> = {}
      fd.forEach((v, k) => {
        snapshot[k] = String(v ?? '')
      })
      sessionStorage.setItem(storageKey, JSON.stringify(snapshot))
    } catch {
      // sessionStorage can be disabled/full — non-fatal, we just lose persistence.
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLFormElement>) => {
    const target = e.target
    if (target && 'name' in target && target.name) {
      setTouched((prev) => (prev[target.name] ? prev : { ...prev, [target.name]: true }))
    }
  }

  const fieldProps = (name: string) => ({
    'data-touched': touched[name] ? 'true' : 'false',
  })

  const handleClose = () => {
    clearPrintSession(artwork.slug)
    router.push('/prints')
  }

  const backToWizard = () => {
    // Forward every wizard option back into the URL so the wizard
    // re-hydrates the buyer's exact selection. Mirrors the
    // wizard → checkout handoff in PrintWizard's handleAddToCart.
    // Falls back to country+provider only when there's no handoff
    // (the bouncing-back-from-stale-link path).
    const params = new URLSearchParams()
    if (handoff) {
      for (const [key, value] of Object.entries(handoff.config.values)) {
        params.set(key, value)
      }
      if (handoff.config.customSize) {
        params.set(
          'customSize',
          `${handoff.config.customSize.widthCm}x${handoff.config.customSize.heightCm}`,
        )
      }
      if (handoff.config.borders) {
        for (const [borderId, b] of Object.entries(handoff.config.borders)) {
          params.set(borderId, String(b.allCm))
        }
      }
    }
    params.set('country', country)
    params.set('provider', providerId)
    router.push(`/artworks/${artwork.slug}/print?${params.toString()}`)
  }

  // If we landed here without a country (URL tampering or stale link) the
  // wizard's validation is the only check we trust — bounce the user back.
  useEffect(() => {
    if (!country) backToWizard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country])

  // Chrome autofill doesn't always fire input events — poll validity a
  // few times after mount so the Continue button unlocks once autofill
  // has landed.
  useEffect(() => {
    const checks = [200, 600, 1200, 2000].map((ms) =>
      setTimeout(() => {
        setFormValid(formRef.current?.checkValidity() ?? false)
      }, ms),
    )
    return () => checks.forEach(clearTimeout)
  }, [])

  // Restore previously entered shipping details (e.g. after bouncing back
  // from the wizard). Inputs are uncontrolled so we hydrate them by name
  // directly — no re-render, no interference with Chrome autofill.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (!raw) return
      const saved = JSON.parse(raw) as Record<string, string>
      const form = formRef.current
      if (!form) return
      for (const [name, value] of Object.entries(saved)) {
        const el = form.elements.namedItem(name)
        if (el instanceof HTMLInputElement && !el.value) {
          el.value = value
        }
      }
      setFormValid(form.checkValidity())
    } catch {
      // Stored blob was unreadable — ignore.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Read the wizard's stash on mount. The wizard always writes a full
  // `WizardHandoff` blob keyed by artwork slug — we trust it as long as
  // the (providerId, country) match the page route's authoritative
  // values. When it doesn't, or it's missing entirely, we re-fetch a
  // live quote from the same provider; if even that fails we bounce
  // the buyer back to the wizard.
  useEffect(() => {
    if (!country) return
    let cancelled = false

    const stash = readHandoff(artwork.slug, providerId, country)
    if (stash) {
      setHandoff(stash)
      setQuoteLoading(false)
      setQuoteError(null)
      return
    }

    // No usable stash — fall back to a live re-quote against the
    // provider URL params alone. We don't have a full WizardConfig
    // server-side, so this branch only runs when the buyer arrived
    // via a stale URL or different tab. In that case there's no
    // config to pass — bounce to the wizard.
    setQuoteLoading(false)
    setQuoteError('Your selection expired. Please reconfigure your print.')
    if (!cancelled) backToWizard()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artwork.slug, providerId, country])

  // Refresh the live quote against the same provider in the background
  // so the totals shown here always come from a fresh server-side
  // calculation — guards against the wizard's stash going stale (e.g.
  // pricing tables changed mid-session). The stash gets us instant
  // first paint; this re-validates.
  useEffect(() => {
    if (!handoff) return
    let cancelled = false

    getProviderQuote(handoff.providerId, {
      config: handoff.config,
      country: handoff.country,
      artistPriceCents: artwork.printPriceCents,
    })
      .then((quote) => {
        if (cancelled) return
        setHandoff((prev) => (prev ? { ...prev, quote } : prev))
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[PrintCheckout] live quote refresh failed:', err)
      })

    return () => {
      cancelled = true
    }
  }, [handoff?.providerId, handoff?.config, handoff?.country, artwork.printPriceCents])

  const quote = handoff?.quote ?? null
  const specs: SpecsSummary = handoff?.specs ?? []
  const orientation: 'portrait' | 'landscape' =
    handoff?.config.values.orientation === 'landscape' ? 'landscape' : 'portrait'

  const canSubmit = !!quote && !quoteLoading && formValid && !!handoff

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const form = formRef.current
    if (!form || !handoff) return

    if (!form.reportValidity()) return

    const fd = new FormData(form)
    const submitted: AddressForm = {
      fullName: String(fd.get('fullName') ?? '').trim(),
      email: String(fd.get('email') ?? '').trim(),
      phone: String(fd.get('phone') ?? '').trim(),
      countryCode: country,
      address1: String(fd.get('address1') ?? '').trim(),
      address2: String(fd.get('address2') ?? '').trim(),
      city: String(fd.get('city') ?? '').trim(),
      stateOrRegion: String(fd.get('state') ?? '').trim(),
      postalCode: String(fd.get('postalCode') ?? '').trim(),
    }

    setSubmitError(null)
    setSubmitting(true)
    try {
      const res = await createPaymentIntent({
        artworkSlug: artwork.slug,
        providerId: handoff.providerId,
        config: handoff.config,
        address: submitted,
      })
      if (!res.ok) {
        setSubmitError(res.error)
        return
      }
      // Stash what the payment page needs. The clientSecret is scoped to
      // this browser session; the address + totals are just so the
      // payment screen can render without re-fetching.
      sessionStorage.setItem(
        `print-payment:${artwork.slug}`,
        JSON.stringify({
          clientSecret: res.clientSecret,
          paymentIntentId: res.paymentIntentId,
          totals: res.totals,
          address: submitted,
          providerId: handoff.providerId,
          config: handoff.config,
          specs: handoff.specs,
          country,
        }),
      )
      const params = new URLSearchParams({ country, provider: handoff.providerId })
      router.push(`/artworks/${artwork.slug}/print/payment?${params.toString()}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (!country) return null

  return (
    <div className={styles.checkout}>
      <header className={styles.header}>
        <Link href="/" aria-label="Go to home" className={styles.logoLink}>
          <Logo className={styles.logo} />
        </Link>
        <span />
        <button
          type="button"
          onClick={handleClose}
          className={styles.closeButton}
          aria-label="Close checkout"
        >
          CLOSE
          <span className={styles.closeIcon}>
            <Icon name="close" size={16} />
          </span>
        </button>
      </header>

      <main className={styles.body}>
        <form
          ref={formRef}
          className={styles.formPanel}
          onSubmit={handleSubmit}
          onInput={handleFormInput}
          onBlur={handleBlur}
        >
          <h2 className={styles.formSectionTitle}>Where should we send it?</h2>

          <div className={styles.destinationLock}>
            <div className={styles.destinationLockLine}>
              <span className={styles.destinationLockLabel}>Shipping to</span>
              <strong className={styles.destinationLockValue}>{countryName(country)}</strong>
            </div>
            <button type="button" onClick={backToWizard} className={styles.destinationLockChange}>
              Change destination
            </button>
          </div>

          <div className={styles.fieldGrid}>
            <div className={`${styles.field} ${styles.fieldFull}`} {...fieldProps('fullName')}>
              <label className={styles.fieldLabel} htmlFor="fullName">
                Full name
              </label>
              <input
                id="fullName"
                name="fullName"
                className={styles.fieldInput}
                type="text"
                autoComplete="name"
                required
                defaultValue=""
              />
              <span className={styles.fieldError}>Please enter your full name.</span>
            </div>

            <div className={styles.field} {...fieldProps('email')}>
              <label className={styles.fieldLabel} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                className={styles.fieldInput}
                type="email"
                autoComplete="email"
                required
                defaultValue=""
              />
              <span className={styles.fieldError}>Please enter a valid email address.</span>
            </div>

            <div className={styles.field} {...fieldProps('phone')}>
              <label className={styles.fieldLabel} htmlFor="phone">
                Phone (for carrier)
              </label>
              <input
                id="phone"
                name="phone"
                className={styles.fieldInput}
                type="tel"
                autoComplete="tel"
                required
                defaultValue=""
              />
              <span className={styles.fieldError}>Please enter a valid phone number.</span>
            </div>

            <div className={`${styles.field} ${styles.fieldFull}`} {...fieldProps('address1')}>
              <label className={styles.fieldLabel} htmlFor="address1">
                Address
              </label>
              <input
                id="address1"
                name="address1"
                className={styles.fieldInput}
                type="text"
                autoComplete="address-line1"
                required
                defaultValue=""
              />
              <span className={styles.fieldError}>Please enter your street address.</span>
            </div>

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.fieldLabel} htmlFor="address2">
                Apartment, suite, etc. (optional)
              </label>
              <input
                id="address2"
                name="address2"
                className={styles.fieldInput}
                type="text"
                autoComplete="address-line2"
                defaultValue=""
              />
            </div>

            <div className={styles.field} {...fieldProps('city')}>
              <label className={styles.fieldLabel} htmlFor="city">
                City
              </label>
              <input
                id="city"
                name="city"
                className={styles.fieldInput}
                type="text"
                autoComplete="address-level2"
                required
                defaultValue=""
              />
              <span className={styles.fieldError}>Please enter a city.</span>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="state">
                State / region
              </label>
              <input
                id="state"
                name="state"
                className={styles.fieldInput}
                type="text"
                autoComplete="address-level1"
                defaultValue=""
              />
            </div>

            <div className={styles.field} {...fieldProps('postalCode')}>
              <label className={styles.fieldLabel} htmlFor="postalCode">
                Postal code
              </label>
              <input
                id="postalCode"
                name="postalCode"
                className={styles.fieldInput}
                type="text"
                autoComplete="postal-code"
                required
                defaultValue=""
              />
              <span className={styles.fieldError}>Please enter a postal code.</span>
            </div>
          </div>

          <div className={styles.editButtonRow}>
            <Button
              variant="secondary"
              size="big"
              label="Back to Configuration"
              iconLeft={<Icon name="arrowLeft" size={20} />}
              onClick={backToWizard}
            />
          </div>
        </form>

        <OrderSummary
          artwork={{
            title: artwork.title,
            artistName: artwork.artistName,
            year: artwork.year,
            imageUrl: artwork.imageUrl,
            originalWidthPx: artwork.originalWidthPx,
            originalHeightPx: artwork.originalHeightPx,
          }}
          specs={specs}
          orientation={orientation}
          country={country}
          priceLines={
            quote
              ? quote.lines.map((line) => ({
                  label: line.label,
                  value: formatEuro(line.amountCents),
                  muted: line.muted,
                }))
              : [
                  {
                    label: 'Artwork',
                    value: quoteLoading ? (
                      <span className={styles.priceCalculating}>
                        Calculating…
                        <span className={styles.priceSpinner} aria-hidden="true">
                          <Icon name="loaderCircle" size={12} />
                        </span>
                      </span>
                    ) : (
                      '—'
                    ),
                  },
                  { label: 'Shipping', value: quoteLoading ? '…' : '—', muted: true },
                ]
          }
          total={{
            label: 'Total (before taxes)',
            value: quote ? formatEuro(quote.subtotalCents) : '—',
          }}
          notes={[quoteError, submitError].filter((n): n is string => Boolean(n))}
          cta={{
            kind: 'button',
            label: submitting ? 'Preparing payment…' : 'Continue to payment',
            onClick: () => {
              void handleSubmit()
            },
            disabled: !canSubmit || submitting,
          }}
        />
      </main>
    </div>
  )
}

/**
 * Read and validate the wizard → checkout handoff blob from
 * sessionStorage. We trust the stash as long as the (providerId,
 * country) match what the server route resolved to. Returns null when
 * the stash is missing, malformed, or for a different
 * provider/country.
 */
function readHandoff(slug: string, providerId: ProviderId, country: string): WizardHandoff | null {
  try {
    const raw = sessionStorage.getItem(`print-quote:${slug}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WizardHandoff>
    if (!parsed.providerId || !parsed.config || !parsed.country || !parsed.quote || !parsed.specs) {
      return null
    }
    if (parsed.providerId !== providerId) return null
    if (parsed.country !== country) return null
    return parsed as WizardHandoff
  } catch {
    return null
  }
}
