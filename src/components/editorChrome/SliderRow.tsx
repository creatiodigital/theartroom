'use client'

import type { CSSProperties } from 'react'
import c from 'classnames'

import { Slider } from '@/components/ui/Slider'

import styles from './SliderRow.module.scss'

type SliderRowProps = {
  /** The visible name; also the slider's accessible name unless `aria-label` says more. */
  label: string
  /** The value chip ("4.5 m", "40%"), also what a screen reader says for the value. */
  value: string
  sliderValue: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  disabled?: boolean
  /**
   * Only where the visible word needs its context to be told apart, and then containing it
   * (questions.md Q135: label in name), e.g. "Lamp 3 turn".
   */
  'aria-label'?: string
  /** Two words under the track's ends, e.g. Narrow / Wide. */
  ends?: [string, string]
  /** fill: dark up to the value; tone: Floor's natural → honey gradient, no fill. */
  track?: 'fill' | 'tone'
}

/**
 * A slider row of the editor's panels (editor3d.md "Slider row"): label and value chip, then the
 * track. The input is today's `Slider` with the caller's min / max / step / value / onChange,
 * restyled here; the track and its filled part are drawn behind it.
 */
export function SliderRow({
  label,
  value,
  sliderValue,
  min,
  max,
  step,
  onChange,
  disabled,
  'aria-label': ariaLabel,
  ends,
  track = 'fill',
}: SliderRowProps) {
  const fill = max > min ? Math.min(1, Math.max(0, (sliderValue - min) / (max - min))) : 0

  return (
    <div className={c(styles.row, disabled && styles.disabled)}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.chip}>{value}</span>
      </div>
      <div
        className={c(styles.control, track === 'tone' && styles.tone)}
        style={{ '--slider-fill': fill } as CSSProperties}
      >
        <span className={styles.track} aria-hidden>
          {track === 'fill' && <span className={styles.fill} />}
        </span>
        <Slider
          className={styles.range}
          min={min}
          max={max}
          step={step}
          value={sliderValue}
          onChange={onChange}
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          aria-valuetext={value}
        />
      </div>
      {ends && (
        <div className={styles.ends}>
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}
    </div>
  )
}
