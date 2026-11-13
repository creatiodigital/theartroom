'use client'

import type { Icon } from '@phosphor-icons/react'
import c from 'classnames'

import styles from './StatusPill.module.scss'

type StatusPillProps = {
  label: string
  /**
   * dark: a working or finished stage; red: needs attention; outline: canceled / refunded;
   * green / amber / info / gray: list statuses (sold, reserved, off-platform, other stages);
   * redSoft: a list status that is missing (red text on light red, e.g. print presentations).
   */
  tone?: 'dark' | 'red' | 'outline' | 'green' | 'amber' | 'info' | 'gray' | 'redSoft'
  /** pill: rounded, next to a title (default); tag: 4px corners, inside a list row. */
  shape?: 'pill' | 'tag'
  /** A 12px filled mark before the label, e.g. Star on "Featured". */
  icon?: Icon
  /** A 6px dot before the label, e.g. "Selling prints" (green: the Published dot's color). */
  dot?: boolean
}

/** A status label: the stage next to a detail page's title (orders.md §2), or a row's status. */
export function StatusPill({
  label,
  tone = 'dark',
  shape = 'pill',
  icon: PillIcon,
  dot = false,
}: StatusPillProps) {
  return (
    <span className={c(styles.pill, styles[tone], shape === 'tag' && styles.tag)}>
      {PillIcon && <PillIcon size={12} weight="fill" aria-hidden className={styles.icon} />}
      {dot && <span aria-hidden className={styles.dot} />}
      {label}
    </span>
  )
}
