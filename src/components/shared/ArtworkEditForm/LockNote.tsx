'use client'

import type { ReactNode } from 'react'
import { LockSimple } from '@phosphor-icons/react'

import styles from './LockNote.module.scss'

/**
 * A grey row with a lock (artist.md §3: "the series-type lock message becomes a
 * grey info row with a lock icon"). Also each live variant's "on sale and
 * frozen" note in the variants editor.
 */
export function LockNote({ children }: { children: ReactNode }) {
  return (
    <div className={styles.note}>
      <LockSimple size={16} weight="light" aria-hidden className={styles.icon} />
      <div className={styles.text}>{children}</div>
    </div>
  )
}
