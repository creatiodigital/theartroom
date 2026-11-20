'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import c from 'classnames'

import { formatDay, formatNumber } from './format'

import styles from './LineChart.module.scss'

export type LineSeries = { key: string; label: string; color: string; values: number[] }

type LineChartProps = {
  /** One per point, "YYYY-MM-DD". */
  dates: string[]
  series: LineSeries[]
  /** What a value counts, for the tooltip and the table ("visits"). */
  unit: string
  /** Spoken summary of the chart. */
  label: string
  /**
   * The last day is still going (the period ends today): its stretch of each line is dashed and
   * its date reads "so far", so the drop to it doesn't read as a fall.
   */
  partialLast?: boolean
}

const HEIGHT = 240
const PAD = { top: 12, right: 12, bottom: 28, left: 40 }
// Room for one date label per ~80px of plot, between 2 and 6 of them.
const X_LABEL_SPACING = 80

/** The smallest "nice" number (1, 2, 5 × 10ⁿ) at or above `n`. */
function niceCeil(n: number): number {
  if (n <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(n))
  for (const step of [1, 2, 5, 10]) if (step * power >= n) return step * power
  return 10 * power
}

/**
 * Lines over days (dataviz: 2px lines, recessive grid, one y-axis), one per segment, with a
 * crosshair that snaps to the nearest day and one tooltip listing every line. Arrow keys move the
 * crosshair; a table under the chart (screen readers) holds every value.
 */
export function LineChart({ dates, series, unit, label, partialLast = false }: LineChartProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, entry.contentRect.width)),
    )
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const count = dates.length
  const plotW = width - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  // Four gridlines at a round step (1, 2, 5 × 10ⁿ), so every tick is a whole, readable number.
  const tickStep = niceCeil(Math.max(4, ...series.flatMap((s) => s.values)) / 4)
  const max = tickStep * 4
  const ticks = [0, 1, 2, 3, 4].map((t) => t * tickStep)
  const x = (i: number) => PAD.left + (count > 1 ? (i / (count - 1)) * plotW : plotW / 2)
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH

  const labelCount = Math.max(2, Math.min(6, Math.floor(plotW / X_LABEL_SPACING)))
  const labelEvery = Math.max(1, Math.ceil(count / labelCount))
  // The last day is labelled too, unless it would crowd the label before it.
  const labelsLast = (count - 1) % labelEvery >= labelEvery * 0.6
  const showsLabel = (i: number) => i % labelEvery === 0 || (i === count - 1 && labelsLast)
  // Where the solid line ends: the last day, unless that day is still going.
  const dashedFrom = partialLast && count > 1 ? count - 2 : count - 1
  const pathThrough = (values: number[], from: number, to: number) =>
    values
      .slice(from, to + 1)
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(from + i)},${y(v)}`)
      .join(' ')
  const dayLabel = (i: number) =>
    partialLast && i === count - 1 ? `${formatDay(dates[i])}, so far` : formatDay(dates[i])
  const indexAt = (clientX: number) => {
    const box = frameRef.current?.getBoundingClientRect()
    if (!box || count === 0) return null
    const ratio = (clientX - box.left - PAD.left) / plotW
    return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))))
  }

  const onPointerMove = (event: PointerEvent<SVGRectElement>) => setActive(indexAt(event.clientX))
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return
    const current = active ?? count - 1
    const next =
      event.key === 'ArrowLeft'
        ? current - 1
        : event.key === 'ArrowRight'
          ? current + 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : null
    if (next === null) return
    event.preventDefault()
    setActive(Math.min(count - 1, Math.max(0, next)))
  }

  const tooltipLeft = active === null ? 0 : x(active)
  const flip = active !== null && tooltipLeft > width / 2

  return (
    <div className={styles.chart}>
      <ul className={styles.legend}>
        {series.map((s) => (
          <li key={s.key} className={styles.legendItem}>
            <span className={styles.lineKey} style={{ background: s.color }} aria-hidden />
            <span className={styles.legendLabel}>{s.label}</span>
            <span className={styles.legendValue}>
              {formatNumber(s.values.reduce((a, b) => a + b, 0))}
            </span>
          </li>
        ))}
      </ul>

      <div
        ref={frameRef}
        className={styles.frame}
        tabIndex={0}
        role="img"
        aria-label={label}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? count - 1)}
        onBlur={() => setActive(null)}
      >
        <svg width={width} height={HEIGHT} className={styles.svg} aria-hidden>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className={t === 0 ? styles.baseline : styles.grid}
              />
              <text x={PAD.left - 8} y={y(t)} className={styles.yLabel} dominantBaseline="middle">
                {formatNumber(t)}
              </text>
            </g>
          ))}
          {dates.map((date, i) =>
            showsLabel(i) ? (
              <text
                key={date}
                x={x(i)}
                y={HEIGHT - 8}
                className={styles.xLabel}
                // The end labels stay inside the chart: the first starts at its day, the last ends at it.
                style={{ textAnchor: i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle' }}
              >
                {formatDay(date)}
              </text>
            ) : null,
          )}
          {series.map((s) => (
            <g key={s.key}>
              <path
                d={pathThrough(s.values, 0, dashedFrom)}
                className={styles.line}
                style={{ stroke: s.color }}
              />
              {dashedFrom < count - 1 && (
                <path
                  d={pathThrough(s.values, dashedFrom, count - 1)}
                  className={c(styles.line, styles.lineSoFar)}
                  style={{ stroke: s.color }}
                />
              )}
            </g>
          ))}
          {active !== null && (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                className={styles.crosshair}
              />
              {series.map((s) => (
                <circle
                  key={s.key}
                  cx={x(active)}
                  cy={y(s.values[active] ?? 0)}
                  r={4}
                  className={styles.dot}
                  style={{ fill: s.color }}
                />
              ))}
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            className={styles.hitArea}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>

        {active !== null && (
          <div
            className={styles.tooltip}
            style={flip ? { right: width - tooltipLeft + 12 } : { left: tooltipLeft + 12 }}
          >
            <span className={styles.tooltipDate}>{dayLabel(active)}</span>
            {series.map((s) => (
              <span key={s.key} className={styles.tooltipRow}>
                <span className={styles.lineKey} style={{ background: s.color }} aria-hidden />
                <span className={styles.tooltipValue}>{formatNumber(s.values[active] ?? 0)}</span>
                <span className={styles.tooltipLabel}>{s.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label} ({unit})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((date, i) => (
            <tr key={date}>
              <th scope="row">{dayLabel(i)}</th>
              {series.map((s) => (
                <td key={s.key}>{s.values[i] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
