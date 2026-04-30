'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Icon } from '@/components/ui/Icon'
import { clearPrintSession } from '@/components/checkout/clearPrintSession'
import Logo from '@/icons/logo.svg'

import {
  type Catalog,
  type PrintRestrictions,
  type Quote,
  type WizardConfig,
  buildAvailability,
  buildInitialConfig,
  summarizeConfig,
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

  // Restore from URL params on mount (e.g. user came back from checkout
  // via backToWizard, which always forwards the in-flight selection in
  // the URL). A bare /print URL = fresh entry; we ignore + later wipe
  // any stale sessionStorage stash from a previous abandoned attempt.
  const urlSeed = useMemo(
    () => readConfigFromParams(catalog, searchParams),
    [catalog, searchParams],
  )
  const hasSeed =
    Object.keys(urlSeed.values).length > 0 ||
    urlSeed.customSize !== undefined ||
    urlSeed.borders !== undefined

  const [config, setConfig] = useState<WizardConfig>(() => {
    const fresh = buildInitialConfig(catalog, aspectRatio, restrictions)
    if (!hasSeed) return fresh
    return {
      ...fresh,
      values: { ...fresh.values, ...urlSeed.values },
      customSize: urlSeed.customSize ?? fresh.customSize,
      borders: urlSeed.borders ?? fresh.borders,
    }
  })

  // Fresh entry → wipe leftovers from a prior abandoned flow so the
  // wizard / checkout / payment surfaces don't surface stale country,
  // address, or payment-intent ids.
  useEffect(() => {
    if (hasSeed) return
    try {
      sessionStorage.removeItem(`print-quote:${artwork.slug}`)
      sessionStorage.removeItem(`print-address:${artwork.slug}`)
      sessionStorage.removeItem(`print-payment:${artwork.slug}`)
    } catch {
      // sessionStorage may be unavailable — non-fatal.
    }
  }, [hasSeed, artwork.slug])

  // Once the client-side image measurement lands, snap orientation to
  // match — unless the user has touched it (URL seed or manual toggle).
  const [orientationTouched, setOrientationTouched] = useState(
    urlSeed.values.orientation !== undefined,
  )
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

  // Country lives on the checkout step. If the buyer already picked one
  // there and bounced back to the wizard via the URL-seeded path, it
  // persists via the wizard handoff stash so the summary reflects the
  // choice (Shipping to: <country> + real shipping line). On fresh
  // entry (no URL seed) we ignore the stash — that's an abandon-restart.
  const [country] = useState<string>(() => {
    if (!hasSeed) return ''
    if (typeof window === 'undefined') return ''
    try {
      const raw = sessionStorage.getItem(`print-quote:${artwork.slug}`)
      if (!raw) return ''
      const parsed = JSON.parse(raw) as { country?: unknown }
      return typeof parsed.country === 'string' ? parsed.country : ''
    } catch {
      return ''
    }
  })

  const canContinue = true

  // Pre-fetch quote on every (config, country) change. Without a
  // country the server returns just the artwork line — shipping + tax
  // appear once a destination is set on the checkout step.
  //
  // We deliberately KEEP the previous quote visible while the new one
  // is in flight. Clearing it on every keystroke makes the price flash
  // between "€X" → "…" → "€Y" as the buyer drags a slider.
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  useEffect(() => {
    let cancelled = false
    setQuoteLoading(true)
    getProviderQuote(catalog.providerId, {
      config,
      country,
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
        setQuoteLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [catalog.providerId, config, country, artwork.printPriceCents])

  const handleAddToCart = () => {
    // Stash everything downstream needs so checkout doesn't have to
    // re-fetch the catalog or re-quote on every render. Country is
    // forwarded if the buyer already picked it; otherwise empty and
    // checkout asks for it.
    const specs = summarizeConfig(catalog, config)
    if (quote) {
      try {
        sessionStorage.setItem(
          `print-quote:${artwork.slug}`,
          JSON.stringify({
            providerId: catalog.providerId,
            config,
            country,
            quote,
            specs,
          }),
        )
      } catch {
        // Non-fatal — checkout will re-fetch.
      }
    }
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(config.values)) {
      params.set(key, value)
    }
    if (config.customSize) {
      params.set('customSize', `${config.customSize.widthCm}x${config.customSize.heightCm}`)
    }
    if (config.borders) {
      for (const [borderId, b] of Object.entries(config.borders)) {
        params.set(borderId, String(b.allCm))
      }
    }
    if (country) params.set('country', country)
    params.set('provider', catalog.providerId)
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
          onClick={() => {
            clearPrintSession(artwork.slug)
            router.push('/prints')
          }}
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
          availability={availability}
          restrictions={restrictions}
        />
        <Scene
          imageUrl={artwork.imageUrl}
          catalog={catalog}
          config={config}
          imageAspectRatio={aspectRatio}
          configReady
        />
        <SummaryPanel
          artwork={artwork}
          catalog={catalog}
          config={config}
          country={country}
          quote={quote}
          quoteLoading={quoteLoading}
          canContinue={canContinue}
          configReady
          onAddToCart={handleAddToCart}
        />
      </main>
    </div>
  )
}

/**
 * Reconstruct a partial config from URL params. Accept a param only
 * when its key matches a catalog dimension id AND its value is a
 * valid option for that dimension (or 'portrait'/'landscape' for the
 * orientation dim). This protects against stale URLs from a different
 * config that doesn't fit the current catalog — e.g. a stale URL
 * `size=60x80` getting merged into a new catalog where size is
 * custom-only and `60x80` resolves to nothing.
 *
 * Also parses `customSize=WxH` (custom W×H in cm) and any border-
 * kind dimension's numeric value, so the buyer's full configuration
 * survives a back-and-forth through the URL — not just enum picks.
 */
function readConfigFromParams(
  catalog: Catalog,
  params: URLSearchParams,
): {
  values: Record<string, string>
  customSize?: { widthCm: number; heightCm: number }
  borders?: Record<string, { allCm: number }>
} {
  const values: Record<string, string> = {}
  const borders: Record<string, { allCm: number }> = {}
  let customSize: { widthCm: number; heightCm: number } | undefined
  const dimsById = new Map(catalog.dimensions.map((d) => [d.id, d]))
  params.forEach((value, key) => {
    if (key === 'country' || key === 'provider') return
    if (key === 'customSize') {
      const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i.exec(value)
      if (m) {
        const w = Number(m[1])
        const h = Number(m[2])
        if (w > 0 && h > 0) customSize = { widthCm: w, heightCm: h }
      }
      return
    }
    const dim = dimsById.get(key)
    if (!dim) return
    if (dim.kind === 'enum') {
      if (dim.options.some((o) => o.id === value)) values[key] = value
    } else if (dim.kind === 'size') {
      if (dim.options.some((o) => o.id === value)) values[key] = value
    } else if (dim.kind === 'orientation') {
      if (value === 'portrait' || value === 'landscape') values[key] = value
    } else if (dim.kind === 'border') {
      const cm = Number(value)
      if (Number.isFinite(cm) && cm >= dim.minCm && cm <= dim.maxCm) {
        borders[key] = { allCm: cm }
      }
    }
  })
  return {
    values,
    customSize,
    borders: Object.keys(borders).length > 0 ? borders : undefined,
  }
}
