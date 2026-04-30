'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'

import type { SpecsSummary } from '@/lib/print-providers'

import { SpecList } from '../../print/SpecList/SpecList'
import styles from './OrderSummary.module.scss'

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
const countryName = (code: string) => regionNames?.of(code) ?? code

export type ArtworkSummary = {
  title: string
  artistName: string
  year?: string
  imageUrl: string
  /** Used to decide whether to rotate the thumb to match the buyer's chosen orientation. */
  originalWidthPx: number
  originalHeightPx: number
}

export type PriceLine = {
  label: string
  value: ReactNode
  muted?: boolean
}

type CtaProps =
  | { kind: 'button'; label: string; onClick: () => void; disabled?: boolean }
  | { kind: 'submit'; label: string; form: string; disabled?: boolean }

interface OrderSummaryProps {
  artwork: ArtworkSummary
  /** Pre-computed display labels. Provider-agnostic — the wizard builds
   *  these from the live catalog; downstream surfaces just render them. */
  specs: SpecsSummary
  /** Buyer's chosen orientation — drives thumb rotation. */
  orientation: 'portrait' | 'landscape'
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
  specs,
  orientation,
  country,
  priceLines,
  total,
  cta,
  notes,
}: OrderSummaryProps) => {
  const thumbRotated =
    (orientation === 'landscape') !== artwork.originalWidthPx >= artwork.originalHeightPx

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

      <SpecList specs={specs} />

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
        <button type="submit" form={cta.form} className={styles.ctaButton} disabled={cta.disabled}>
          {cta.label}
        </button>
      )}
    </aside>
  )
}
