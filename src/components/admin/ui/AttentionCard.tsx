'use client'

import Link from 'next/link'
import type { Icon } from '@phosphor-icons/react'
import c from 'classnames'

import styles from './AttentionCard.module.scss'

type AttentionCardProps = {
  label: string
  icon: Icon
  /** null while loading or after a failed read: shows "–", never a guessed 0. */
  count: number | null
  /** The read failed: with `count` null the hint says "Unavailable" instead of "Loading…". */
  failed?: boolean
  /** Only applied when count > 0; a zero stays neutral. */
  tone: 'red' | 'amber'
  /** Shown in green at 0, e.g. "Nothing owed". */
  zeroHint: string
  href: string
}

/** One "Needs your attention" card (dashboard-states.dc.html §1). */
export function AttentionCard({
  label,
  icon: CardIcon,
  count,
  failed = false,
  tone,
  zeroHint,
  href,
}: AttentionCardProps) {
  const state = count === null ? 'unknown' : count > 0 ? tone : 'zero'
  const hint =
    count === null ? (failed ? 'Unavailable' : 'Loading…') : count > 0 ? 'Review now →' : zeroHint

  return (
    <Link href={href} className={c(styles.card, styles[state])}>
      <span className={styles.top}>
        <span aria-hidden className={styles.iconBox}>
          <CardIcon size={16} weight="light" />
        </span>
        <span className={styles.label}>{label}</span>
      </span>
      <span className={styles.value}>{count ?? '–'}</span>
      <span className={styles.hint}>{hint}</span>
    </Link>
  )
}
