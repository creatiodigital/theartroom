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
import type { PrintConfig, WizardArtwork } from './types'

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
  /** Destination country — needed to apply EU VAT on top of the quote. */
  countryCode: string
  /** Live Prodigi quote for (config, country). Null while loading/unavailable. */
  quote: ProdigiQuoteResult | null
  quoteLoading: boolean
}

export const SummaryPanel = ({
  artwork,
  config,
  onAddToCart,
  canContinue,
  configReady,
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

  const showFrame = format.framed
  const moldingWidthCm = showFrame ? 2.0 : 0 // Prodigi Classic molding width
  const mattingBorderCm = showFrame ? mount.borderCm : 0

  // SIZES are declared portrait. Swap when the buyer chose landscape so the
  // schema matches the 3D preview and the printed orientation.
  const isLandscape = config.orientation === 'landscape'
  const printWidthCm = isLandscape ? size.heightCm : size.widthCm
  const printHeightCm = isLandscape ? size.widthCm : size.heightCm

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
        <SizeSchema
          printWidthCm={printWidthCm}
          printHeightCm={printHeightCm}
          moldingWidthCm={moldingWidthCm}
          moldingColorHex={frameColor.hex}
          mattingBorderCm={mattingBorderCm}
          mattingColorHex="#f6f3ec"
          showFrame={showFrame}
        />
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
          <dd>{formatSize(size, config.orientation)}</dd>
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
          </dl>
          <div className={styles.totalRow}>
            <span>Total (before taxes)</span>
            <span className={styles.totalValue}>{formatEuro(totals.preTaxCents)}</span>
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
