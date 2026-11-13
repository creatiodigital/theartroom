'use client'

import styles from './DonutChart.module.scss'

export type DonutSegment = { label: string; value: number }
/** `includes`: the segments folded into an "Other" slice. */
export type DonutSlice = DonutSegment & { includes?: string[] }

// Five grays, darkest first; one per slice (components.md, DonutChart).
const SLICE_COLORS = [
  'var(--admin-chart-1)',
  'var(--admin-chart-2)',
  'var(--admin-chart-3)',
  'var(--admin-chart-4)',
  'var(--admin-chart-5)',
]

/**
 * At most five slices, so each gets its own gray: past five, the fifth becomes
 * "Other" (the lightest gray, last) and carries the sum of the rest and their
 * names (questions.md Q8). Input order is kept (largest first, as GA returns it).
 */
export function toDonutSlices(segments: DonutSegment[], otherLabel = 'Other'): DonutSlice[] {
  if (segments.length <= SLICE_COLORS.length) return segments
  const kept = segments.slice(0, SLICE_COLORS.length - 1)
  const rest = segments.slice(SLICE_COLORS.length - 1)
  return [
    ...kept,
    {
      label: otherLabel,
      value: rest.reduce((sum, s) => sum + s.value, 0),
      includes: rest.map((s) => s.label),
    },
  ]
}

type DonutChartProps = {
  /** Used for the chart's spoken description, e.g. "Traffic channels". */
  title: string
  segments: DonutSegment[]
  /** Word under the total, e.g. "sessions". */
  totalLabel: string
}

/** A CSS conic-gradient donut with its legend. No chart library. */
export function DonutChart({ title, segments, totalLabel }: DonutChartProps) {
  const slices = toDonutSlices(segments)
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const percent = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  let start = 0
  const stops = slices.map((s, i) => {
    const from = start
    start += total > 0 ? (s.value / total) * 100 : 0
    return `${SLICE_COLORS[i]} ${from.toFixed(2)}% ${start.toFixed(2)}%`
  })
  const background = total > 0 ? `conic-gradient(${stops.join(', ')})` : undefined

  const description =
    total > 0
      ? `${title}: ${slices
          .map(
            (s) =>
              `${s.label} ${percent(s.value)}%${s.includes ? ` (${s.includes.join(', ')})` : ''}`,
          )
          .join(', ')}`
      : `${title}: no ${totalLabel} yet`

  return (
    <div className={styles.chart}>
      <div role="img" aria-label={description} className={styles.ring} style={{ background }}>
        <div className={styles.hole}>
          <span className={styles.total}>{total}</span>
          <span className={styles.totalLabel}>{totalLabel}</span>
        </div>
      </div>
      <ul className={styles.legend}>
        {slices.map((s, i) => (
          <li key={s.label} className={styles.legendRow}>
            <span aria-hidden className={styles.swatch} style={{ background: SLICE_COLORS[i] }} />
            <span className={styles.legendText}>
              <span className={styles.legendName}>{s.label}</span>
              <span className={styles.legendValue}>
                {s.value}
                <span className={styles.legendPercent}> ({percent(s.value)}%)</span>
              </span>
              {s.includes && <span className={styles.legendIncludes}>{s.includes.join(', ')}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
