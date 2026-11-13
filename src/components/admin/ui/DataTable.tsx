'use client'

import type { ReactNode } from 'react'
import c from 'classnames'

import styles from './DataTable.module.scss'

type DataTableProps = {
  /** `<thead>` and `<tbody>`, written by the page. */
  children: ReactNode
  /** Extra class on the <table>, e.g. a page's phone-card layout. */
  className?: string
}

/**
 * The admin table shell (orders.md §1): gray header row, 14px rows split by a
 * light divider, top-aligned. Scrolls sideways inside its panel when narrow.
 * Pages style their own cells; under 900px a page may turn rows into cards
 * through `className`.
 */
export function DataTable({ children, className }: DataTableProps) {
  return (
    <div className={styles.scroll}>
      <table className={c(styles.table, className)}>{children}</table>
    </div>
  )
}
