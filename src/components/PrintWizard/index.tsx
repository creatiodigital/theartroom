'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Icon } from '@/components/ui/Icon'
import Logo from '@/icons/logo.svg'

import { getCachedCatalog, setCachedCatalog } from './catalogClientCache'
import { getPrintCatalog } from './getPrintCatalog'
import type { SkuData } from './getPrintCatalog'
import {
  buildDefaultConfig,
  collectAllCountries,
  configShipsTo,
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

  const updateConfig = (patch: Partial<PrintConfig>) =>
    setConfig((prev) => normalizePrintConfig({ ...prev, ...patch }))

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

  useEffect(() => {
    if (catalog.kind === 'ready') return
    let cancelled = false
    getPrintCatalog().then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setCatalog({ kind: 'error' })
        return
      }
      setCachedCatalog(res.skus)
      setCatalog({
        kind: 'ready',
        catalog: res.skus,
        countries: collectAllCountries(res.skus),
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

  useEffect(() => {
    if (catalog.kind !== 'ready') return
    if (!countryCode) {
      prevCountryRef.current = ''
      return
    }
    const firstPick = prevCountryRef.current === ''
    prevCountryRef.current = countryCode

    if (firstPick) {
      // No hardcoded defaults — we don't yet know what's actually in the
      // catalog for this destination, so seed from the first shippable
      // combo the catalog exposes (respecting aspect-ratio fit).
      const initial = firstShippableConfig(countryCode, catalog.catalog, aspectRatio)
      if (initial) setConfig(initial)
      return
    }

    // Country changed. Preserve as many of the user's existing picks as
    // still ship to the new destination; silently adjust the rest.
    if (shipsCurrent) return
    const fixed = findShippableConfig(config, countryCode, catalog.catalog, aspectRatio)
    if (fixed) setConfig(fixed)
  }, [catalog, countryCode, shipsCurrent, config, aspectRatio])

  const canContinue = catalog.kind === 'ready' && !!countryCode && shipsCurrent

  const handleAddToCart = () => {
    if (!canContinue) return
    const params = new URLSearchParams({
      paper: config.paperId,
      format: config.formatId,
      size: config.sizeId,
      color: config.frameColorId,
      mount: config.mountId,
      country: countryCode,
    })
    router.push(`/artworks/${artwork.slug}/print/checkout?${params.toString()}`)
  }

  return (
    <div className={styles.wizard}>
      <header className={styles.header}>
        <Logo className={styles.logo} />
        <span className={styles.headerTitle}>Order a print</span>
        <button
          type="button"
          onClick={() => router.back()}
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
          onChange={updateConfig}
          countryCode={countryCode}
          onCountryChange={setCountryCode}
          catalogStatus={catalog}
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
        />
      </main>
    </div>
  )
}
