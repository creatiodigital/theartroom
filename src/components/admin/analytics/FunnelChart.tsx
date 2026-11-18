'use client'

import { useState } from 'react'

import type { FunnelStep } from '@/lib/analytics/reportShape'

import { formatChange, formatNumber, formatPercent } from './format'

import styles from './FunnelChart.module.scss'

type FunnelChartProps = {
  steps: FunnelStep[]
  /** Segments in colour order, with their colour. */
  segments: { label: string; color: string }[]
  /** "30 days", for the comparison line. */
  periodLabel: string
}

type Hover = { step: string; segment: string } | null

/**
 * The way to an order: one bar per step, as long as the people who reached it (the first step is
 * the full width), split into the segments; beside it the people, the share of the step before and
 * the change from the period before. Every number is on screen; the tooltip adds each segment's.
 */
export function FunnelChart({ steps, segments, periodLabel }: FunnelChartProps) {
  const [hover, setHover] = useState<Hover>(null)
  const first = steps[0]?.total || 1

  return (
    <div className={styles.funnel}>
      <ol className={styles.steps}>
        {steps.map((step, i) => {
          const before = i > 0 ? steps[i - 1].total : null
          const shareOfBefore = before ? step.total / before : null
          const widthOf = (n: number) => `${Math.max(0, (n / first) * 100)}%`
          return (
            <li key={step.id} className={styles.step}>
              <div className={styles.text}>
                <span className={styles.label}>{step.label}</span>
                <span className={styles.meta}>
                  {shareOfBefore === null
                    ? `${formatChange(step.total, step.previous, periodLabel)}`
                    : before === 0
                      ? '–'
                      : `${formatPercent(shareOfBefore)} of the step before`}
                </span>
              </div>

              <div className={styles.track}>
                <div className={styles.bar} style={{ width: widthOf(step.total) }}>
                  {segments.map((segment) => {
                    const n = step.bySegment[segment.label] ?? 0
                    if (n <= 0) return null
                    const shown = hover?.step === step.id && hover.segment === segment.label
                    const sumOfSegments = Object.values(step.bySegment).reduce((a, b) => a + b, 0)
                    return (
                      <span
                        key={segment.label}
                        className={styles.segment}
                        style={{ flexGrow: n, background: segment.color }}
                        tabIndex={0}
                        aria-label={`${step.label}, ${segment.label}: ${n}`}
                        onPointerEnter={() => setHover({ step: step.id, segment: segment.label })}
                        onPointerLeave={() => setHover(null)}
                        onFocus={() => setHover({ step: step.id, segment: segment.label })}
                        onBlur={() => setHover(null)}
                      >
                        {shown && (
                          <span className={styles.tooltip}>
                            <strong>{formatNumber(n)}</strong> {segment.label} ·{' '}
                            {formatPercent(n / Math.max(1, sumOfSegments))} of this step
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className={styles.numbers}>
                <span className={styles.total}>{formatNumber(step.total)}</span>
                {i > 0 && (
                  <span className={styles.ofFirst}>
                    {formatPercent(step.total / first)} of visitors
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <ul className={styles.legend} aria-label="Segments">
        {segments.map((segment) => (
          <li key={segment.label} className={styles.legendItem}>
            <span className={styles.key} style={{ background: segment.color }} aria-hidden />
            {segment.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
