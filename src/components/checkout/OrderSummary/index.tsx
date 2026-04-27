'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'

import {
  formatSize,
  getFormat,
  getFrameColor,
  getMount,
  getPaper,
  getSize,
} from '@/components/PrintWizard/options'
import type { PrintConfig, WizardArtwork } from '@/components/PrintWizard/types'

import styles from './OrderSummary.module.scss'

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
const countryName = (code: string) => regionNames?.of(code) ?? code

export type PriceLine = {
  label: string
  value: ReactNode
  muted?: boolean
}

type CtaProps =
  | { kind: 'button'; label: string; onClick: () => void; disabled?: boolean }
  | { kind: 'submit'; label: string; form: string; disabled?: boolean }

interface OrderSummaryProps {
  artwork: WizardArtwork
  config: PrintConfig
  /** When set, renders a "Shipping to <country>" line above price rows. */
  country?: string
  priceLines: PriceLine[]
  total: { label: string; value: ReactNode }
  cta: CtaProps
  /** Optional notes (errors, info) rendered between total and CTA. */
  notes?: string[]
}

export const OrderSummary = ({
  artwork,
  config,
  country,
  priceLines,
  total,
  cta,
  notes,
}: OrderSummaryProps) => {
  const paper = getPaper(config.paperId)
  const format = getFormat(config.formatId)
  const size = getSize(config.sizeId)
  const frameColor = getFrameColor(config.frameColorId)
  const mount = getMount(config.mountId)

  // The thumbnail's natural orientation may not match the buyer's chosen
  // orientation — rotate the thumb by 90° in that case so it reads right.
  const thumbRotated =
    (config.orientation === 'landscape') !==
    artwork.originalWidthPx >= artwork.originalHeightPx

  return (
    <aside className={styles.summaryPanel}>
      <div className={styles.summaryHeader}>
        {artwork.imageUrl && (
          <Image
            src={artwork.imageUrl}
            alt={artwork.title}
            width={72}
            height={72}
            className={`${styles.summaryThumb}${thumbRotated ? ` ${styles.summaryThumbRotated}` : ''}`}
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
          <span>{formatSize(size, config.orientation)}</span>
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

      <div className={styles.priceList}>
        {country && (
          <div className={styles.priceRow}>
            <span>Shipping to</span>
            <strong>{countryName(country)}</strong>
          </div>
        )}
        {priceLines.map((line) => (
          <div
            key={line.label}
            className={`${styles.priceRow}${line.muted ? ` ${styles.priceRowMuted}` : ''}`}
          >
            <span>{line.label}</span>
            <span>{line.value}</span>
          </div>
        ))}
      </div>

      <div className={styles.totalRow}>
        <span>{total.label}</span>
        <span className={styles.totalValue}>{total.value}</span>
      </div>

      {notes?.map((note) => (
        <p key={note} className={styles.note}>
          {note}
        </p>
      ))}

      {cta.kind === 'button' ? (
        <button
          type="button"
          className={styles.ctaButton}
          onClick={cta.onClick}
          disabled={cta.disabled}
        >
          {cta.label}
        </button>
      ) : (
        <button
          type="submit"
          form={cta.form}
          className={styles.ctaButton}
          disabled={cta.disabled}
        >
          {cta.label}
        </button>
      )}
    </aside>
  )
}
