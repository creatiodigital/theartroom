'use client'

import c from 'classnames'

import styles from './StatusPill.module.scss'

type StatusPillProps = {
  label: string
  /** dark: a working or finished stage; red: needs attention; outline: canceled / refunded. */
  tone?: 'dark' | 'red' | 'outline'
}

/** The rounded stage label next to a detail page's title (orders.md §2). */
export function StatusPill({ label, tone = 'dark' }: StatusPillProps) {
  return <span className={c(styles.pill, styles[tone])}>{label}</span>
}
