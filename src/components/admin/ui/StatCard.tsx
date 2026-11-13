'use client'

import type { ReactNode } from 'react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import styles from './StatCard.module.scss'

type StatCardProps = {
  label: string
  /** null while loading or after a failed read: shows "–", never a guessed 0. */
  value: ReactNode | null
  /** One small line under the value, e.g. "numbered copies". */
  hint?: ReactNode
  /** amber: something to act on (the page decides when, e.g. count > 0). */
  tone?: 'plain' | 'amber'
  /** count: 32px whole numbers; money: 28px amounts (invoices, payouts). */
  size?: 'count' | 'money'
  /** With `onSelect`: whether the filter this card sets is the active one. */
  pressed?: boolean
  /** Makes the card a toggle button (aria-pressed) that sets a filter. */
  onSelect?: () => void
}

/**
 * A summary number above a list (sales.md §1, Edition sales): caps label,
 * big value, one hint. No icon; the dashboard's AttentionCard is the linked,
 * iconed sibling.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = 'plain',
  size = 'count',
  pressed = false,
  onSelect,
}: StatCardProps) {
  const unknown = value === null
  const className = c(styles.card, styles[tone], styles[size], unknown && styles.unknown)
  const content = (
    <>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{unknown ? '–' : value}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </>
  )

  if (!onSelect) return <div className={className}>{content}</div>

  return (
    <Button
      variant="bare"
      font="dashboard"
      className={c(className, styles.button)}
      aria-pressed={pressed}
      onClick={onSelect}
    >
      {content}
    </Button>
  )
}
