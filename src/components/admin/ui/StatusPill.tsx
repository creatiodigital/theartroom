'use client'

import c from 'classnames'

import styles from './StatusPill.module.scss'

type StatusPillProps = {
  label: string
  /**
   * dark: a working or finished stage; red: needs attention; outline: canceled / refunded;
   * green / amber / info / gray: list statuses (sold, reserved, off-platform, other stages).
   */
  tone?: 'dark' | 'red' | 'outline' | 'green' | 'amber' | 'info' | 'gray'
  /** pill: rounded, next to a title (default); tag: 4px corners, inside a list row. */
  shape?: 'pill' | 'tag'
}

/** A status label: the stage next to a detail page's title (orders.md §2), or a row's status. */
export function StatusPill({ label, tone = 'dark', shape = 'pill' }: StatusPillProps) {
  return (
    <span className={c(styles.pill, styles[tone], shape === 'tag' && styles.tag)}>{label}</span>
  )
}
