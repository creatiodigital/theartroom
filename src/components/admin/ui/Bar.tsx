'use client'

import c from 'classnames'

import styles from './Bar.module.scss'

/**
 * Width of a bar relative to the largest value: 0 stays empty, anything above
 * shows at least a sliver (3%) so a small count never reads as none.
 */
export function barPercent(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0
  return Math.max(3, Math.round((value / max) * 100))
}

type BarProps = {
  value: number
  max: number
  /** `thin` = the phone lists' 6px bar. */
  size?: 'regular' | 'thin'
  /** What it sits on: `gray` darkens the track for a `--color-gray-15` row (the render progress). */
  surface?: 'white' | 'gray'
}

/** A horizontal bar on a gray track (components.md, BarList). Decorative: the number sits next to it. */
export function Bar({ value, max, size = 'regular', surface = 'white' }: BarProps) {
  return (
    <span
      aria-hidden
      className={c(
        styles.track,
        size === 'thin' && styles.thin,
        surface === 'gray' && styles.onGray,
      )}
    >
      <span className={styles.fill} style={{ width: `${barPercent(value, max)}%` }} />
    </span>
  )
}
