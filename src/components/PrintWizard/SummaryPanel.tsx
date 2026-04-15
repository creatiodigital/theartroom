'use client'

import { useState } from 'react'

import {
  computePrice,
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
}

export const SummaryPanel = ({
  artwork,
  config,
  imageAspectRatio,
  onAddToCart,
  canContinue,
  configReady,
}: SummaryPanelProps) => {
  const paper = getPaper(config.paperId)
  const format = getFormat(config.formatId)
  const size = getSize(config.sizeId)
  const frameColor = getFrameColor(config.frameColorId)
  const mount = getMount(config.mountId)

  const price = computePrice(config, { artistPriceCents: artwork.artistPriceCents })

  // Display unit for the schema + measurements. Local to the summary —
  // doesn't touch the PrintConfig or trigger re-quotes.
  const [displayUnit, setDisplayUnit] = useState<SizeUnit>('cm')

  const formatDim = (cm: number) =>
    displayUnit === 'inches' ? `${Math.round(cm / 2.54)} in` : `${cm.toFixed(0)} cm`

  const showFrame = format.framed
  const mouldingWidthCm = showFrame ? 2.0 : 0 // Prodigi Classic moulding width
  const mattingBorderCm = showFrame ? mount.borderCm : 0

  // SIZES are declared portrait. Swap when the artwork is landscape so the
  // schema + measurements reflect the printed orientation.
  const isLandscape = imageAspectRatio > 1
  const printWidthCm = isLandscape ? size.heightCm : size.widthCm
  const printHeightCm = isLandscape ? size.widthCm : size.heightCm
  const matWidthCm = printWidthCm + mattingBorderCm * 2
  const matHeightCm = printHeightCm + mattingBorderCm * 2
  const overallWidthCm = matWidthCm + mouldingWidthCm * 2
  const overallHeightCm = matHeightCm + mouldingWidthCm * 2

  if (!configReady) {
    return (
      <aside className={styles.summaryPanel}>
        <div className={styles.summaryHeader}>
          <span className={styles.summaryEyebrow}>{artwork.artistName}</span>
          <h2 className={styles.summaryTitle}>{artwork.title}</h2>
        </div>
        <p className={styles.shippingNote}>
          Pick a shipping destination to see the preview, size details and price for your print.
        </p>
        <button type="button" className={styles.ctaButton} onClick={onAddToCart} disabled>
          Continue to checkout
        </button>
      </aside>
    )
  }

  return (
    <aside className={styles.summaryPanel}>
      <div className={styles.summaryHeader}>
        <span className={styles.summaryEyebrow}>{artwork.artistName}</span>
        <h2 className={styles.summaryTitle}>{artwork.title}</h2>
      </div>

      <div className={styles.schemaSection}>
        <div className={styles.unitToggle} role="group" aria-label="Measurement unit">
          <button
            type="button"
            className={`${styles.unitToggleOption} ${displayUnit === 'cm' ? styles.unitToggleOptionActive : ''}`}
            onClick={() => setDisplayUnit('cm')}
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
            onClick={() => setDisplayUnit('inches')}
            aria-pressed={displayUnit === 'inches'}
          >
            in
          </button>
        </div>
        <SizeSchema
          printWidthCm={printWidthCm}
          printHeightCm={printHeightCm}
          mouldingWidthCm={mouldingWidthCm}
          mouldingColorHex={frameColor.hex}
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
          <dd>{formatSize(size, displayUnit)}</dd>
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

      <p className={styles.shippingNote}>
        Shipping and taxes calculated at checkout based on your delivery address.
      </p>

      <div className={styles.totalRow}>
        <span>Price</span>
        <span className={styles.totalValue}>{formatEuro(price.subtotalCents)}</span>
      </div>

      <button
        type="button"
        className={styles.ctaButton}
        onClick={onAddToCart}
        disabled={!canContinue}
      >
        Continue to checkout
      </button>
    </aside>
  )
}
