'use client'

import type { ReactNode } from 'react'
import { Info } from '@phosphor-icons/react'

import styles from './InfoLine.module.scss'

/** A note line with an info mark (the Bake and Benches panels' notes, as drawn). */
export function InfoLine({ children }: { children: ReactNode }) {
  return (
    <p className={styles.line}>
      <Info size={14} weight="light" aria-hidden className={styles.icon} />
      <span>{children}</span>
    </p>
  )
}
