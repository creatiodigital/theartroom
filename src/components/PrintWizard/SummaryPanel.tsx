'use client'

import { useMemo } from 'react'

import {
  type Catalog,
  type Quote,
  type WizardConfig,
  collectVisualHints,
  formatEuro,
  getEffectiveBorderCm,
  getEffectiveMatCm,
  getEffectiveSizeCm,
  summarizeConfig,
} from '@/lib/print-providers'

import { SpecList } from '../print/SpecList/SpecList'
import { SizeSchema } from './SizeSchema'
import type { WizardArtwork } from './index'

import styles from './PrintWizard.module.scss'

interface SummaryPanelProps {
  artwork: WizardArtwork
  catalog: Catalog
  config: WizardConfig
  /** ISO country code if the buyer already picked one on checkout (then
   *  navigated back). Empty string when the destination hasn't been
   *  chosen yet — the summary shows "—" for shipping in that case. */
  country: string
  quote: Quote | null
  quoteLoading: boolean
  canContinue: boolean
  configReady: boolean
  onAddToCart: () => void
}

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
const countryName = (code: string) => regionNames?.of(code) ?? code

export const SummaryPanel = ({
  artwork,
  catalog,
  config,
  country,
  quote,
  quoteLoading,
  canContinue,
  configReady,
  onAddToCart,
}: SummaryPanelProps) => {
  const orientation: 'portrait' | 'landscape' =
    config.values.orientation === 'landscape' ? 'landscape' : 'portrait'

  // Effective print size — preset OR custom. Drives schema + label.
  const effectiveSize = useMemo(() => getEffectiveSizeCm(catalog, config), [catalog, config])

  // Merged visual hints from every selected enum option. The TPS
  // (`color` dim) and TPS (`moulding` dim) write into `frameColorHex`
  // — the merge picks whichever is set.
  const visuals = useMemo(() => collectVisualHints(catalog, config), [catalog, config])

  const borderCm = getEffectiveBorderCm(config, 'border')
  const matCm = getEffectiveMatCm(catalog, config)

  const showFrame = visuals.framed === true
  const moldingWidthCm = showFrame ? (visuals.mouldingWidthCm ?? 2.0) : 0
  const mattingBorderCm = showFrame ? matCm : 0
  const moldingColorHex = visuals.frameColorHex ?? '#0b0b0b'
  const mattingColorHex = visuals.matColorHex ?? '#f6f3ec'

  // Sizes are stored portrait. Landscape orientation swaps width/height
  // so the schema and label match how the print will be hung.
  const isLandscape = orientation === 'landscape'
  const printWidthCm = effectiveSize
    ? isLandscape
      ? effectiveSize.heightCm
      : effectiveSize.widthCm
    : 0
  const printHeightCm = effectiveSize
    ? isLandscape
      ? effectiveSize.widthCm
      : effectiveSize.heightCm
    : 0

  if (!configReady) {
    return (
      <aside className={styles.summaryPanel}>
        <div className={styles.summaryHeader}>
          <span className={styles.summaryEyebrow}>{artwork.artistName}</span>
          <h2 className={styles.summaryTitle}>{artwork.title}</h2>
          {artwork.year && <span className={styles.summaryYear}>{artwork.year}</span>}
        </div>
        <button type="button" className={styles.ctaButton} onClick={onAddToCart} disabled>
          Add shipping address
        </button>
      </aside>
    )
  }

  return (
    <aside className={styles.summaryPanel}>
      <div className={styles.summaryHeader}>
        <span className={styles.summaryEyebrow}>{artwork.artistName}</span>
        <h2 className={styles.summaryTitle}>{artwork.title}</h2>
        {artwork.year && <span className={styles.summaryYear}>{artwork.year}</span>}
      </div>

      {effectiveSize && (
        <div className={styles.schemaSection}>
          <SizeSchema
            printWidthCm={printWidthCm}
            printHeightCm={printHeightCm}
            moldingWidthCm={moldingWidthCm}
            moldingColorHex={moldingColorHex}
            mattingBorderCm={mattingBorderCm + borderCm}
            mattingColorHex={borderCm > 0 ? '#ffffff' : mattingColorHex}
            showFrame={showFrame || borderCm > 0}
          />
        </div>
      )}

      <SpecList specs={summarizeConfig(catalog, config)} />

      {(() => {
        const artworkLine = quote?.lines.find((l) => l.id === 'artwork')
        const shippingLine = quote?.lines.find((l) => l.id === 'shipping')
        const placeholder = quoteLoading ? '…' : '—'
        const vatLabel = quote?.taxLabel ?? 'VAT'
        return (
          <dl className={styles.priceList}>
            <div className={styles.priceRow}>
              <dt>Shipping to</dt>
              <dd>{country ? countryName(country) : '—'}</dd>
            </div>
            <div className={styles.priceRow}>
              <dt>Artwork</dt>
              <dd>{artworkLine ? formatEuro(artworkLine.amountCents) : placeholder}</dd>
            </div>
            <div className={`${styles.priceRow} ${styles.priceRowMuted}`}>
              <dt>Shipping</dt>
              <dd>{shippingLine ? formatEuro(shippingLine.amountCents) : '—'}</dd>
            </div>
            <div className={`${styles.priceRow} ${styles.priceRowMuted}`}>
              <dt>{vatLabel}</dt>
              <dd>{quote && quote.taxCents > 0 ? formatEuro(quote.taxCents) : '—'}</dd>
            </div>
          </dl>
        )
      })()}

      <button
        type="button"
        className={styles.ctaButton}
        onClick={onAddToCart}
        disabled={!canContinue}
      >
        Add shipping address
      </button>
    </aside>
  )
}
