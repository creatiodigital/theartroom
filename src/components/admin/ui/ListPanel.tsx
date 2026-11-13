'use client'

import type { ReactNode } from 'react'

import styles from './ListPanel.module.scss'

type ListPanelProps = {
  /** The section's spoken name, e.g. "Copies". */
  label: string
  /** Filters on the left of the toolbar row (they wrap). */
  toolbar?: ReactNode
  /** Right end of the toolbar row, e.g. "11 copies". */
  count?: ReactNode
  /** One small line under the list. */
  footnote?: ReactNode
  /** The table, an EmptyState or a loading line. */
  children: ReactNode
}

/**
 * The white panel around an admin list (sales.md, orders.md): toolbar row with
 * the count on the right, the list, an optional footnote. The toolbar row only
 * renders when there is a toolbar or a count.
 */
export function ListPanel({ label, toolbar, count, footnote, children }: ListPanelProps) {
  return (
    <section aria-label={label} className={styles.panel}>
      {(toolbar || count) && (
        <div className={styles.toolbar}>
          {toolbar}
          {count && <span className={styles.count}>{count}</span>}
        </div>
      )}
      {children}
      {footnote && <div className={styles.footnote}>{footnote}</div>}
    </section>
  )
}
