'use client'

import type { ReactNode } from 'react'

import { Bar } from './Bar'

import styles from './BarList.module.scss'

export type BarListRow = {
  key: string
  label: ReactNode
  /** Second line under the label (e.g. the artist). */
  sublabel?: ReactNode
  value: number
}

type BarListProps = {
  rows: BarListRow[]
  emptyMessage: string
  /**
   * `list`: label · bar · value rows (Visitors by country).
   * `table`: a three-column table on desktop, stacked rows on phone (Most viewed artworks).
   */
  variant?: 'list' | 'table'
  /** Column headings for `table`. */
  columns?: { label: string; share: string; value: string }
}

/** Ranked rows with bars relative to the largest value (components.md, BarList). */
export function BarList({ rows, emptyMessage, variant = 'list', columns }: BarListProps) {
  if (rows.length === 0) return <p className={styles.empty}>{emptyMessage}</p>

  const max = Math.max(0, ...rows.map((r) => r.value))

  if (variant === 'list') {
    return (
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.key} className={styles.listRow}>
            <span className={styles.listLabel}>{row.label}</span>
            <Bar value={row.value} max={max} />
            <span className={styles.value}>{row.value}</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{columns?.label}</th>
            <th scope="col" className={styles.shareCol}>
              {columns?.share}
            </th>
            <th scope="col" className={styles.valueCol}>
              {columns?.value}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <span className={styles.title}>{row.label}</span>
                {row.sublabel && <span className={styles.sublabel}>{row.sublabel}</span>}
              </td>
              <td>
                <Bar value={row.value} max={max} />
              </td>
              <td className={styles.value}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className={styles.stacked}>
        {rows.map((row) => (
          <li key={row.key} className={styles.stackedRow}>
            <span className={styles.stackedHead}>
              <span className={styles.stackedText}>
                <span className={styles.title}>{row.label}</span>
                {row.sublabel && <span className={styles.sublabel}>{row.sublabel}</span>}
              </span>
              <span className={styles.value}>{row.value}</span>
            </span>
            <Bar value={row.value} max={max} size="thin" />
          </li>
        ))}
      </ul>
    </>
  )
}
