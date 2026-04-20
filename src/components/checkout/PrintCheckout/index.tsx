'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import Logo from '@/icons/logo.svg'
import {
  computeQuotedTotals,
  formatEuro,
  formatSize,
  getFormat,
  getFrameColor,
  getMount,
  getPaper,
  getSize,
} from '@/components/PrintWizard/options'
import type { PrintConfig, WizardArtwork } from '@/components/PrintWizard/types'

import { createPaymentIntent } from './createPaymentIntent'
import { getProdigiQuote } from './getQuote'
import type { ProdigiQuoteResult } from './getQuote'

import styles from './PrintCheckout.module.scss'

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
const countryName = (code: string) => regionNames?.of(code) ?? code

interface PrintCheckoutProps {
  artwork: WizardArtwork
  config: PrintConfig
  /** ISO country code the wizard validated against Prodigi's shipsTo list. */
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

export const PrintCheckout = ({ artwork, config, country }: PrintCheckoutProps) => {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [quote, setQuote] = useState<ProdigiQuoteResult | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
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

  const backToWizard = () => {
    const params = new URLSearchParams({
      paper: config.paperId,
      format: config.formatId,
      size: config.sizeId,
      color: config.frameColorId,
      mount: config.mountId,
      orientation: config.orientation,
      unit: config.unit,
      country,
    })
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

  const paper = getPaper(config.paperId)
  const format = getFormat(config.formatId)
  const size = getSize(config.sizeId)
  const frameColor = getFrameColor(config.frameColorId)
  const mount = getMount(config.mountId)

  // Quote is fetched once for the wizard-chosen country; it won't change on
  // this page. (If the user wants a different destination they go back.)
  // First try the stash the wizard left behind — saves a Prodigi round-trip
  // on every advance. The stash is only trusted if it was cut against the
  // exact (config, country) we're rendering for.
  useEffect(() => {
    if (!country) return
    try {
      const raw = sessionStorage.getItem(`print-quote:${artwork.slug}`)
      if (raw) {
        const stashed = JSON.parse(raw) as {
          config: PrintConfig
          country: string
          quote: ProdigiQuoteResult
        }
        const same =
          stashed.country === country &&
          stashed.config.paperId === config.paperId &&
          stashed.config.formatId === config.formatId &&
          stashed.config.sizeId === config.sizeId &&
          stashed.config.frameColorId === config.frameColorId &&
          stashed.config.mountId === config.mountId &&
          stashed.config.orientation === config.orientation
        if (same) {
          setQuote(stashed.quote)
          setQuoteLoading(false)
          setQuoteError(null)
          return
        }
      }
    } catch {
      // Unreadable stash — ignore and fall through to a live fetch.
    }

    let cancelled = false
    setQuoteLoading(true)
    setQuoteError(null)
    getProdigiQuote(config, country).then((res) => {
      if (cancelled) return
      if (res.ok) {
        setQuote(res.data)
        try {
          sessionStorage.setItem(
            `print-quote:${artwork.slug}`,
            JSON.stringify({ config, country, quote: res.data }),
          )
        } catch {
          // Non-fatal; stashing is a perf optimisation only.
        }
      } else {
        setQuote(null)
        setQuoteError(`SKU ${res.sku} — ${res.error}`)
      }
      setQuoteLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [config, country, artwork.slug])

  const totals = quote
    ? computeQuotedTotals({
        printPriceCents: artwork.printPriceCents,
        prodigiItemCents: quote.itemCents,
        prodigiShippingCents: quote.shippingCents,
        countryCode: country,
      })
    : null
  const customerVatCents = totals?.customerVatCents ?? 0
  const totalCents = totals?.totalCents ?? 0
  const artistCents = artwork.printPriceCents
  const galleryCents = totals?.galleryCents ?? 0

  const canSubmit = !!quote && !quoteLoading && formValid

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const form = formRef.current
    if (!form) return

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
        config,
        address: submitted,
      })
      if (!res.ok) {
        setSubmitError(res.error)
        return
      }
      // Stash what the payment page needs. The clientSecret is scoped to
      // this browser session; the address + totals are just so the
      // payment screen can render a summary without re-fetching.
      sessionStorage.setItem(
        `print-payment:${artwork.slug}`,
        JSON.stringify({
          clientSecret: res.clientSecret,
          paymentIntentId: res.paymentIntentId,
          totals: res.totals,
          address: submitted,
          config,
          country,
        }),
      )
      const params = new URLSearchParams({
        paper: config.paperId,
        format: config.formatId,
        size: config.sizeId,
        color: config.frameColorId,
        mount: config.mountId,
        orientation: config.orientation,
        unit: config.unit,
        country,
      })
      router.push(`/artworks/${artwork.slug}/print/payment?${params.toString()}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (!country) return null

  return (
    <div className={styles.checkout}>
      <header className={styles.header}>
        <Logo className={styles.logo} />
        <span className={styles.headerTitle}>Checkout</span>
        <button
          type="button"
          onClick={backToWizard}
          className={styles.backButton}
          aria-label="Back to configure"
        >
          <Icon name="arrowLeft" size={16} />
          BACK
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
              <span>{formatSize(size, config.unit, config.orientation)}</span>
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

          <dl className={styles.priceList}>
            <div className={styles.priceRow}>
              <dt>Artwork</dt>
              <dd>
                {quoteLoading && !quote ? (
                  <span className={styles.priceCalculating}>
                    Calculating…
                    <span className={styles.priceSpinner} aria-hidden="true">
                      <Icon name="loaderCircle" size={12} />
                    </span>
                  </span>
                ) : quote ? (
                  formatEuro(quote.itemCents + artistCents + galleryCents)
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className={`${styles.priceRow} ${styles.priceRowMuted}`}>
              <dt>Shipping</dt>
              <dd>{quoteLoading ? '…' : quote ? formatEuro(quote.shippingCents) : '—'}</dd>
            </div>
            {customerVatCents > 0 && quote && (
              <div className={`${styles.priceRow} ${styles.priceRowMuted}`}>
                <dt>VAT (21%)</dt>
                <dd>{formatEuro(customerVatCents)}</dd>
              </div>
            )}
          </dl>

          <div className={styles.totalRow}>
            <span>Total</span>
            <span className={styles.totalValue}>{quote ? formatEuro(totalCents) : '—'}</span>
          </div>

          {quoteError && <p className={styles.quoteNote}>{quoteError}</p>}
          {submitError && <p className={styles.quoteNote}>{submitError}</p>}

          <button
            type="button"
            className={styles.ctaButton}
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            style={{ marginTop: 'var(--space-4)' }}
          >
            {submitting ? 'Preparing payment…' : 'Continue to payment'}
          </button>
        </aside>
      </main>
    </div>
  )
}
