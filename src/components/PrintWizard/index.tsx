'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Icon } from '@/components/ui/Icon'
import Logo from '@/icons/logo.svg'

import {
  type Catalog,
  type PrintRestrictions,
  type Quote,
  type WizardConfig,
  buildAvailability,
  buildInitialConfig,
  configShipsTo,
  findShippableConfig,
} from '@/lib/print-providers'
import { getProviderQuote } from '@/lib/print-providers/quote'

import { Scene } from './Scene'
import { StepsPanel } from './StepsPanel'
import { SummaryPanel } from './SummaryPanel'

import styles from './PrintWizard.module.scss'

export type WizardArtwork = {
  slug: string
  title: string
  artistName: string
  year?: string
  imageUrl: string
  originalWidthPx: number
  originalHeightPx: number
  printPriceCents: number
}

interface PrintWizardProps {
  artwork: WizardArtwork
  catalog: Catalog
  /** Provider-agnostic, dimension-keyed restriction map (already converted by the page route). */
  restrictions: PrintRestrictions | null
}

export const PrintWizard = ({ artwork, catalog, restrictions }: PrintWizardProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Synchronous availability check, rebuilt only when the catalog
  // identity changes (i.e. essentially never within one wizard session).
  const availability = useMemo(() => buildAvailability(catalog), [catalog])

  // Measure the actual image client-side as a fallback when DB-reported
  // dimensions are absent or wrong.
  const [measuredAspect, setMeasuredAspect] = useState<number | null>(null)
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setMeasuredAspect(img.naturalWidth / img.naturalHeight)
      }
    }
    img.src = artwork.imageUrl
  }, [artwork.imageUrl])

  const aspectRatio =
    measuredAspect ??
    (artwork.originalWidthPx > 0 && artwork.originalHeightPx > 0
      ? artwork.originalWidthPx / artwork.originalHeightPx
      : 1)

  // Restore from URL params on mount (e.g. user came back from checkout).
  const urlSeed = useMemo(
    () => readConfigFromParams(catalog, searchParams),
    [catalog, searchParams],
  )
  const urlCountry = searchParams.get('country') ?? ''

  const [config, setConfig] = useState<WizardConfig>(() => {
    const fresh = buildInitialConfig(catalog, aspectRatio, restrictions)
    if (Object.keys(urlSeed).length === 0) return fresh
    return { values: { ...fresh.values, ...urlSeed } }
  })

  // Once the client-side image measurement lands, snap orientation to
  // match — unless the user has touched it (URL seed or manual toggle).
  const [orientationTouched, setOrientationTouched] = useState(urlSeed.orientation !== undefined)
  useEffect(() => {
    if (orientationTouched || measuredAspect === null) return
    const derived = measuredAspect < 1 ? 'portrait' : 'landscape'
    setConfig((prev) =>
      prev.values.orientation === derived
        ? prev
        : { ...prev, values: { ...prev.values, orientation: derived } },
    )
  }, [measuredAspect, orientationTouched])

  const updateConfig = (patch: Record<string, string>) => {
    if (patch.orientation !== undefined) setOrientationTouched(true)
    setConfig((prev) => ({ ...prev, values: { ...prev.values, ...patch } }))
  }

  const updateCustomSize = (size: { widthCm: number; heightCm: number }) => {
    setConfig((prev) => ({ ...prev, customSize: size }))
  }

  const updateBorder = (dimensionId: string, allCm: number) => {
    setConfig((prev) => ({
      ...prev,
      borders: { ...(prev.borders ?? {}), [dimensionId]: { allCm } },
    }))
  }

  const [countryCode, setCountryCode] = useState<string>(urlCountry)

  // Tracks last country so we can distinguish "first pick" (seed initial
  // config from catalog availability) from "country change" (preserve
  // picks where possible, snap others).
  const prevCountryRef = useRef(urlCountry)

  // True when no combination satisfies (ships-to-country) AND
  // (artist-allowed) for the current destination.
  const [noViableCombo, setNoViableCombo] = useState(false)

  const shipsCurrent = useMemo(
    () => configShipsTo(catalog, config, countryCode, availability),
    [catalog, config, countryCode, availability],
  )

  useEffect(() => {
    if (!countryCode) {
      prevCountryRef.current = ''
      setNoViableCombo(false)
      return
    }

    const firstPick = prevCountryRef.current === ''
    prevCountryRef.current = countryCode

    if (firstPick) {
      const fresh = buildInitialConfig(catalog, aspectRatio, restrictions)
      if (configShipsTo(catalog, fresh, countryCode, availability)) {
        setConfig(fresh)
        setNoViableCombo(false)
        return
      }
      const seeded = findShippableConfig(catalog, fresh, countryCode, availability, restrictions)
      if (seeded) {
        setConfig(seeded)
        setNoViableCombo(false)
      } else {
        setNoViableCombo(true)
      }
      return
    }

    if (shipsCurrent) {
      setNoViableCombo(false)
      return
    }
    const fixed = findShippableConfig(catalog, config, countryCode, availability, restrictions)
    if (fixed) {
      setConfig(fixed)
      setNoViableCombo(false)
    } else {
      setNoViableCombo(true)
    }
  }, [catalog, countryCode, shipsCurrent, config, aspectRatio, availability, restrictions])

  const canContinue = !!countryCode && shipsCurrent && !noViableCombo

  // Pre-fetch quote eagerly on every config/country change so the
  // summary always reflects the current selection. Cancelled mid-flight
  // when inputs change to avoid races.
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  useEffect(() => {
    if (!canContinue) {
      setQuote(null)
      setQuoteLoading(false)
      return
    }
    let cancelled = false
    setQuote(null)
    setQuoteLoading(true)
    getProviderQuote(catalog.providerId, {
      config,
      country: countryCode,
      artistPriceCents: artwork.printPriceCents,
    })
      .then((q) => {
        if (cancelled) return
        setQuote(q)
        setQuoteLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[PrintWizard] quote failed:', err)
        setQuote(null)
        setQuoteLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canContinue, catalog.providerId, config, countryCode, artwork.printPriceCents])

  const handleAddToCart = () => {
    if (!canContinue) return
    if (quote) {
      try {
        sessionStorage.setItem(
          `print-quote:${artwork.slug}`,
          JSON.stringify({ config, country: countryCode, quote }),
        )
      } catch {
        // Non-fatal — checkout will re-fetch.
      }
    }
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(config.values)) {
      params.set(key, value)
    }
    params.set('country', countryCode)
    router.push(`/artworks/${artwork.slug}/print/checkout?${params.toString()}`)
  }

  return (
    <div className={styles.wizard}>
      <header className={styles.header}>
        <Link href="/" aria-label="Go to home" className={styles.logoLink}>
          <Logo className={styles.logo} />
        </Link>
        <span />
        <button
          type="button"
          onClick={() => router.push('/prints')}
          className={styles.closeButton}
          aria-label="Close wizard"
        >
          CLOSE
          <span className={styles.closeIcon}>
            <Icon name="close" size={16} />
          </span>
        </button>
      </header>

      <main className={styles.body}>
        <StepsPanel
          catalog={catalog}
          config={config}
          aspectRatio={aspectRatio}
          onChange={updateConfig}
          onCustomSizeChange={updateCustomSize}
          onBorderChange={updateBorder}
          countryCode={countryCode}
          onCountryChange={setCountryCode}
          availability={availability}
          restrictions={restrictions}
          noViableCombo={noViableCombo}
        />
        <Scene
          imageUrl={artwork.imageUrl}
          catalog={catalog}
          config={config}
          imageAspectRatio={aspectRatio}
          configReady={canContinue}
        />
        <SummaryPanel
          artwork={artwork}
          catalog={catalog}
          config={config}
          countryCode={countryCode}
          quote={quote}
          quoteLoading={quoteLoading}
          canContinue={canContinue}
          configReady={canContinue}
          onAddToCart={handleAddToCart}
        />
      </main>
    </div>
  )
}

/**
 * Reconstruct a partial config from URL params. We accept any param
 * whose name matches one of the catalog's dimension ids — anything
 * else is ignored. Sanitizing happens later inside the wizard.
 */
function readConfigFromParams(catalog: Catalog, params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {}
  const known = new Set(catalog.dimensions.map((d) => d.id))
  params.forEach((value, key) => {
    if (key === 'country') return
    if (known.has(key)) out[key] = value
  })
  return out
}
