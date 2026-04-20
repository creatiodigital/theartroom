'use client'

import type { ProdigiQuoteResult } from '@/components/checkout/PrintCheckout/getQuote'

import {
  computeQuotedTotals,
  formatEuro,
  formatSize,
  getFormat,
  getFrameColor,
  getMount,
  getPaper,
  getSize,
} from './options'
import { SizeSchema } from './SizeSchema'
import type { PrintConfig, SizeUnit, WizardArtwork } from './types'

import styles from './PrintWizard.module.scss'

interface SummaryPanelProps {
  artwork: WizardArtwork
  config: PrintConfig
  /** Pixel aspect ratio of the artwork. > 1 = landscape → dimensions swap. */
  imageAspectRatio: number
  onAddToCart: () => void
  canContinue: boolean
  /** Hide all config-specific content (schema/specs/price) until true. */
  configReady: boolean
  /** Update the parent config — used by the cm/in display toggle. */
  onUnitChange: (unit: SizeUnit) => void
  /** Destination country — needed to apply EU VAT on top of the quote. */
  countryCode: string
  /** Live Prodigi quote for (config, country). Null while loading/unavailable. */
  quote: ProdigiQuoteResult | null
  quoteLoading: boolean
}

export const SummaryPanel = ({
  artwork,
  config,
  imageAspectRatio,
  onAddToCart,
  canContinue,
  configReady,
  onUnitChange,
  countryCode,
  quote,
  quoteLoading,
}: SummaryPanelProps) => {
  const paper = getPaper(config.paperId)
  const format = getFormat(config.formatId)
  const size = getSize(config.sizeId)
  const frameColor = getFrameColor(config.frameColorId)
  const mount = getMount(config.mountId)

  const totals = quote
    ? computeQuotedTotals({
        printPriceCents: artwork.printPriceCents,
        prodigiItemCents: quote.itemCents,
        prodigiShippingCents: quote.shippingCents,
        countryCode,
      })
    : null

  // Display unit lives on PrintConfig so it propagates to checkout via the
  // URL — otherwise the buyer toggles inches here and the next step still
  // shows cm, which reads like a bug.
  const displayUnit = config.unit

  const formatDim = (cm: number) =>
    displayUnit === 'inches' ? `${Math.round(cm / 2.54)} in` : `${cm.toFixed(0)} cm`

  const showFrame = format.framed
  const moldingWidthCm = showFrame ? 2.0 : 0 // Prodigi Classic molding width
  const mattingBorderCm = showFrame ? mount.borderCm : 0

  // SIZES are declared portrait. Swap when the buyer chose landscape so the
  // schema + measurements match the 3D preview and the printed orientation.
  const isLandscape = config.orientation === 'landscape'
  const printWidthCm = isLandscape ? size.heightCm : size.widthCm
  const printHeightCm = isLandscape ? size.widthCm : size.heightCm
  const matWidthCm = printWidthCm + mattingBorderCm * 2
  const matHeightCm = printHeightCm + mattingBorderCm * 2
  const overallWidthCm = matWidthCm + moldingWidthCm * 2
  const overallHeightCm = matHeightCm + moldingWidthCm * 2

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

      <div className={styles.schemaSection}>
        <div className={styles.unitToggle} role="group" aria-label="Measurement unit">
          <button
            type="button"
            className={`${styles.unitToggleOption} ${displayUnit === 'cm' ? styles.unitToggleOptionActive : ''}`}
            onClick={() => onUnitChange('cm')}
            aria-pressed={displayUnit === 'cm'}
          >
            cm
          </button>
          <span className={styles.unitToggleSeparator} aria-hidden="true">
            |
          </span>
          <button
            type="button"
            className={`${styles.unitToggleOption} ${displayUnit === 'inches' ? styles.unitToggleOptionActive : ''}`}
            onClick={() => onUnitChange('inches')}
            aria-pressed={displayUnit === 'inches'}
          >
            in
          </button>
        </div>
        <SizeSchema
          printWidthCm={printWidthCm}
          printHeightCm={printHeightCm}
          moldingWidthCm={moldingWidthCm}
          moldingColorHex={frameColor.hex}
          mattingBorderCm={mattingBorderCm}
          mattingColorHex="#f6f3ec"
          showFrame={showFrame}
          unit={displayUnit}
        />
        <dl className={styles.measurementsList}>
          <div>
            <dt>Print size</dt>
            <dd>
              {formatDim(printWidthCm)} × {formatDim(printHeightCm)}
            </dd>
          </div>
          {showFrame && mount.id !== 'none' && (
            <div>
              <dt>Mount outer</dt>
              <dd>
                {formatDim(matWidthCm)} × {formatDim(matHeightCm)}
              </dd>
            </div>
          )}
          {showFrame && (
            <div>
              <dt>Overall size (incl. frame)</dt>
              <dd>
                {formatDim(overallWidthCm)} × {formatDim(overallHeightCm)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <dl className={styles.specList}>
        <div>
          <dt>Paper</dt>
          <dd>{paper.label}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{format.label}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{formatSize(size, displayUnit, config.orientation)}</dd>
        </div>
        {showFrame && (
          <>
            <div>
              <dt>Frame</dt>
              <dd>{frameColor.label}</dd>
            </div>
            <div>
              <dt>Mount</dt>
              <dd>{mount.label}</dd>
            </div>
          </>
        )}
      </dl>

      {totals ? (
        <>
          <dl className={styles.priceList}>
            <div className={styles.priceRow}>
              <dt>Artwork</dt>
              <dd>
                {formatEuro(totals.artistCents + totals.galleryCents + totals.prodigiItemCents)}
              </dd>
            </div>
            <div className={`${styles.priceRow} ${styles.priceRowMuted}`}>
              <dt>Shipping</dt>
              <dd>{formatEuro(totals.prodigiShippingCents)}</dd>
            </div>
            {totals.customerVatCents > 0 && (
              <div className={`${styles.priceRow} ${styles.priceRowMuted}`}>
                <dt>VAT (21%)</dt>
                <dd>{formatEuro(totals.customerVatCents)}</dd>
              </div>
            )}
          </dl>
          <div className={styles.totalRow}>
            <span>Total</span>
            <span className={styles.totalValue}>{formatEuro(totals.totalCents)}</span>
          </div>
        </>
      ) : (
        <div className={styles.totalRow}>
          <span>Total</span>
          <span className={styles.totalValue}>{quoteLoading ? 'Calculating…' : '—'}</span>
        </div>
      )}

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
