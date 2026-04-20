'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Icon } from '@/components/ui/Icon'
import Logo from '@/icons/logo.svg'

import { getProdigiQuote } from '@/components/checkout/PrintCheckout/getQuote'
import type { ProdigiQuoteResult } from '@/components/checkout/PrintCheckout/getQuote'

import {
  getCachedCatalog,
  getCachedCountries,
  hydrateCountriesFromStorage,
  setCachedCatalog,
  setCachedCountries,
} from './catalogClientCache'
import { getPrintCatalog } from './getPrintCatalog'
import type { SkuData } from './getPrintCatalog'
import {
  buildDefaultConfig,
  collectAllCountries,
  configShipsTo,
  deriveOrientation,
  findShippableConfig,
  firstShippableConfig,
  normalizePrintConfig,
} from './options'
import { Scene } from './Scene'
import { StepsPanel } from './StepsPanel'
import { SummaryPanel } from './SummaryPanel'
import type { PrintConfig, WizardArtwork } from './types'

import styles from './PrintWizard.module.scss'

interface PrintWizardProps {
  artwork: WizardArtwork
}

export type CatalogStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; catalog: SkuData[]; countries: string[] }
  | { kind: 'error' }

const UNIT_STORAGE_KEY = 'artroom:print-unit'

export const PrintWizard = ({ artwork }: PrintWizardProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  // If the user came back here from checkout via "Change destination", the
  // URL carries their previous picks + country. Restore them so they don't
  // have to re-configure. Unknown/missing ids are sanitised by
  // normalizePrintConfig; a missing country stays empty (user must re-pick).
  const urlCountry = searchParams.get('country') ?? ''
  const urlConfigSeed: Partial<PrintConfig> = {
    paperId: (searchParams.get('paper') ?? undefined) as PrintConfig['paperId'] | undefined,
    formatId: (searchParams.get('format') ?? undefined) as PrintConfig['formatId'] | undefined,
    sizeId: (searchParams.get('size') ?? undefined) as PrintConfig['sizeId'] | undefined,
    frameColorId: (searchParams.get('color') ?? undefined) as
      | PrintConfig['frameColorId']
      | undefined,
    mountId: (searchParams.get('mount') ?? undefined) as PrintConfig['mountId'] | undefined,
    orientation: (searchParams.get('orientation') ?? undefined) as
      | PrintConfig['orientation']
      | undefined,
    unit: (searchParams.get('unit') ?? undefined) as PrintConfig['unit'] | undefined,
  }
  const hasUrlConfig = Object.values(urlConfigSeed).some((v) => v !== undefined)

  // DB-reported dimensions aren't always accurate (old artworks may lack them,
  // new uploads may not have been measured yet). Measure the actual image
  // client-side as a fallback so landscape/portrait detection is always right.
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

  const aspectRatio = measuredAspect ?? artwork.originalWidthPx / artwork.originalHeightPx

  const [config, setConfig] = useState<PrintConfig>(() => {
    const base = buildDefaultConfig(artwork.originalWidthPx, artwork.originalHeightPx)
    if (!hasUrlConfig) return base
    return normalizePrintConfig({ ...base, ...urlConfigSeed })
  })

  // Keep the orientation default in sync with the real image ratio. DB
  // dimensions can be missing on older artworks, in which case buildDefaultConfig
  // fell back to 'portrait' regardless of the actual image. Once the
  // client-side measurement lands, flip orientation to match — unless the
  // user has already picked one explicitly (URL seed or manual toggle).
  const [orientationTouched, setOrientationTouched] = useState(
    urlConfigSeed.orientation !== undefined,
  )
  useEffect(() => {
    if (orientationTouched || measuredAspect === null) return
    const derived = deriveOrientation(measuredAspect)
    setConfig((prev) =>
      prev.orientation === derived ? prev : normalizePrintConfig({ ...prev, orientation: derived }),
    )
  }, [measuredAspect, orientationTouched])

  const updateConfig = (patch: Partial<PrintConfig>) => {
    if (patch.orientation !== undefined) setOrientationTouched(true)
    setConfig((prev) => normalizePrintConfig({ ...prev, ...patch }))
  }

  // Unit preference persists across visits via localStorage so returning
  // buyers keep their previous cm/in choice. URL seed (e.g. returning from
  // checkout) always wins over storage. Reading localStorage must happen
  // in an effect to avoid SSR/client hydration mismatch.
  useEffect(() => {
    if (urlConfigSeed.unit !== undefined) return
    try {
      const saved = window.localStorage.getItem(UNIT_STORAGE_KEY)
      if (saved === 'cm' || saved === 'inches') {
        setConfig((prev) => (prev.unit === saved ? prev : { ...prev, unit: saved }))
      }
    } catch {
      // localStorage unavailable (private mode, quota, etc.) — fall back
      // silently to whatever default buildDefaultConfig set.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUnitChange = (unit: PrintConfig['unit']) => {
    updateConfig({ unit })
    try {
      window.localStorage.setItem(UNIT_STORAGE_KEY, unit)
    } catch {
      // See note above — persistence failure is non-critical.
    }
  }

  // Country is picked by the user — never defaulted. Restored from the URL
  // if the user came back from checkout; otherwise empty until chosen.
  const [countryCode, setCountryCode] = useState<string>(urlCountry)

  // Pre-fetch the full catalog once on mount. If we already fetched it
  // earlier in this session (e.g. user navigated wizard → checkout → back),
  // hydrate synchronously from the client cache so there's no loading
  // flash on soft navigations.
  const [catalog, setCatalog] = useState<CatalogStatus>(() => {
    const cached = getCachedCatalog()
    if (cached) {
      return {
        kind: 'ready',
        catalog: cached,
        countries: collectAllCountries(cached),
      }
    }
    return { kind: 'loading' }
  })

  // Persisted countries list (localStorage). Stays null until the
  // useEffect below hydrates it — doing so during render would break
  // SSR/client hydration parity.
  const [fallbackCountries, setFallbackCountries] = useState<string[] | null>(null)

  useEffect(() => {
    hydrateCountriesFromStorage()
    const cached = getCachedCountries()
    if (cached) setFallbackCountries(cached)
  }, [])

  useEffect(() => {
    if (catalog.kind === 'ready') return
    let cancelled = false
    getPrintCatalog().then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setCatalog({ kind: 'error' })
        return
      }
      const countries = collectAllCountries(res.skus)
      setCachedCatalog(res.skus)
      setCachedCountries(countries)
      setFallbackCountries(countries)
      setCatalog({
        kind: 'ready',
        catalog: res.skus,
        countries,
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Whether the current (config, country) pair actually ships. Derived —
  // no extra API calls.
  const shipsCurrent = useMemo(() => {
    if (catalog.kind !== 'ready') return false
    if (!countryCode) return false
    return configShipsTo(config, countryCode, catalog.catalog)
  }, [catalog, config, countryCode])

  // Tracks the last country the user was configuring for. Used to
  // distinguish "first country pick" (build a fresh initial config from
  // the catalog) from "country change" (preserve picks where possible).
  // Seeded from the URL so restoring state from checkout doesn't cause
  // an unwanted first-pick reset on top of the user's existing config.
  const prevCountryRef = useRef(urlCountry)

  // Whether any config at all satisfies (ships-to-country) AND
  // (artist's restrictions). When this is false for the selected
  // country, the wizard shows an "unavailable for this destination"
  // message rather than drifting into a banned-but-shipping config.
  const [noViableCombo, setNoViableCombo] = useState(false)

  useEffect(() => {
    if (catalog.kind !== 'ready') return
    if (!countryCode) {
      prevCountryRef.current = ''
      setNoViableCombo(false)
      return
    }
    const firstPick = prevCountryRef.current === ''
    prevCountryRef.current = countryCode

    if (firstPick) {
      // No hardcoded defaults — we don't yet know what's actually in the
      // catalog for this destination, so seed from the first shippable
      // combo the catalog exposes (respecting aspect-ratio fit AND the
      // artist's per-artwork restrictions).
      const initial = firstShippableConfig(
        countryCode,
        catalog.catalog,
        aspectRatio,
        artwork.printOptions ?? null,
      )
      if (initial) {
        setConfig(initial)
        setNoViableCombo(false)
      } else {
        // Nothing this artwork allows ships to the chosen country.
        setNoViableCombo(true)
      }
      return
    }

    // Country changed. Preserve as many of the user's existing picks as
    // still ship to the new destination AND remain allowed by the
    // artist; silently adjust the rest. If nothing works, flag as
    // no-viable-combo so the UI can explain.
    if (shipsCurrent) {
      setNoViableCombo(false)
      return
    }
    const fixed = findShippableConfig(
      config,
      countryCode,
      catalog.catalog,
      aspectRatio,
      artwork.printOptions ?? null,
    )
    if (fixed) {
      setConfig(fixed)
      setNoViableCombo(false)
    } else {
      setNoViableCombo(true)
    }
  }, [catalog, countryCode, shipsCurrent, config, aspectRatio, artwork.printOptions])

  const canContinue = catalog.kind === 'ready' && !!countryCode && shipsCurrent && !noViableCombo

  // Fetch a real Prodigi quote so the summary shows the final total (incl.
  // shipping + VAT) before the user advances to checkout. Prodigi's quote
  // is country-deterministic — no address required — so this matches what
  // the checkout page will show. Fetched eagerly on every config/country
  // change so the displayed total always reflects the current selection;
  // in-flight quotes are cancelled via the `cancelled` flag.
  const [quote, setQuote] = useState<ProdigiQuoteResult | null>(null)
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
    getProdigiQuote(config, countryCode).then((res) => {
      if (cancelled) return
      setQuote(res.ok ? res.data : null)
      setQuoteLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [canContinue, config, countryCode])

  const handleAddToCart = () => {
    if (!canContinue) return
    // Hand the checkout the quote we already fetched here so it doesn't
    // have to round-trip Prodigi again. Stashed against the exact
    // (config, country) it was quoted for — the checkout re-validates
    // before using, and falls back to its own fetch on mismatch.
    if (quote) {
      try {
        sessionStorage.setItem(
          `print-quote:${artwork.slug}`,
          JSON.stringify({ config, country: countryCode, quote }),
        )
      } catch {
        // Non-fatal — checkout will just re-fetch.
      }
    }
    const params = new URLSearchParams({
      paper: config.paperId,
      format: config.formatId,
      size: config.sizeId,
      color: config.frameColorId,
      mount: config.mountId,
      orientation: config.orientation,
      unit: config.unit,
      country: countryCode,
    })
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
          config={config}
          aspectRatio={aspectRatio}
          originalWidthPx={artwork.originalWidthPx}
          originalHeightPx={artwork.originalHeightPx}
          onChange={updateConfig}
          countryCode={countryCode}
          onCountryChange={setCountryCode}
          catalogStatus={catalog}
          fallbackCountries={fallbackCountries}
          printOptions={artwork.printOptions ?? null}
          noViableCombo={noViableCombo}
        />
        <Scene
          imageUrl={artwork.imageUrl}
          config={config}
          imageAspectRatio={aspectRatio}
          configReady={canContinue}
        />
        <SummaryPanel
          artwork={artwork}
          config={config}
          imageAspectRatio={aspectRatio}
          onAddToCart={handleAddToCart}
          canContinue={canContinue}
          configReady={canContinue}
          onUnitChange={handleUnitChange}
          countryCode={countryCode}
          quote={quote}
          quoteLoading={quoteLoading}
        />
      </main>
    </div>
  )
}
