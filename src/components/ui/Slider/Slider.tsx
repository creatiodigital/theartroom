'use client'

import c from 'classnames'
import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

import styles from './Slider.module.scss'

type SliderProps = {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  disabled?: boolean
  className?: string
  'aria-label'?: string
  /** What a screen reader says for the value, e.g. "4.5 m" (the editor's value chip). */
  'aria-valuetext'?: string
  /**
   * The print wizard's touch row (docs/public-redesign/mobile-sliders.md): a tall invisible row over
   * the whole track takes the pointer, so a finger can start anywhere on it (far from the screen's
   * back-swipe edge) and the page neither scrolls nor pans while sliding. Same look; the native input
   * stays underneath for focus, arrow keys and `aria-valuetext`.
   */
  touchRow?: boolean
}

/** A length custom property of the input, in px (`--slider-thumb`, `--slider-thumb-hit`). */
const cssPx = (el: Element, name: string) => parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0

const decimalsOf = (step: number) => (String(step).split('.')[1] ?? '').length

/**
 * Numeric range slider used by the editor panels (lighting, floor, human,
 * camera, wall/ceiling, presentation, artwork transforms, etc.) and the print
 * wizard. The styling lives here once instead of being duplicated across every
 * panel's stylesheet.
 */
export const Slider = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  className,
  'aria-label': ariaLabel,
  'aria-valuetext': ariaValueText,
  touchRow = false,
}: SliderProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  // The pointer dragging, and how far from the knob's centre it took hold (0 when it jumped there).
  const drag = useRef<{ pointerId: number; offset: number } | null>(null)

  const input = (
    <input
      ref={inputRef}
      type="range"
      className={c(styles.slider, touchRow && styles.inTouchRow, className)}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
    />
  )
  if (!touchRow) return input

  // The knob travels inside the track: its edge, not its centre, meets each end (the browser's own
  // range layout), so the value under the finger maps over the track minus one knob.
  const geometry = () => {
    const el = inputRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const thumb = cssPx(el, '--slider-thumb')
    return { el, left: rect.left + thumb / 2, travel: Math.max(0, rect.width - thumb) }
  }

  const valueAt = (clientX: number, offset: number) => {
    const g = geometry()
    if (!g || g.travel === 0 || max <= min) return min
    const ratio = Math.min(1, Math.max(0, (clientX - offset - g.left) / g.travel))
    const snapped = min + Math.round((ratio * (max - min)) / step) * step
    return Math.min(max, Math.max(min, Number(snapped.toFixed(decimalsOf(step)))))
  }

  const send = (next: number) => {
    if (next !== value) onChange(next)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return
    const g = geometry()
    if (!g) return
    e.preventDefault()
    // On the knob (its hit area, wider than the dot): hold it where it was taken, no jump.
    // Anywhere else on the row: the knob jumps under the finger and the drag goes on from there.
    const ratio = max > min ? (value - min) / (max - min) : 0
    const knobX = g.left + ratio * g.travel
    const onKnob = Math.abs(e.clientX - knobX) <= cssPx(g.el, '--slider-thumb-hit') / 2
    drag.current = { pointerId: e.pointerId, offset: onKnob ? e.clientX - knobX : 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
    g.el.focus({ preventScroll: true })
    if (!onKnob) send(valueAt(e.clientX, 0))
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (drag.current?.pointerId !== e.pointerId) return
    send(valueAt(e.clientX, drag.current.offset))
  }

  const endDrag = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (drag.current?.pointerId === e.pointerId) drag.current = null
  }

  return (
    <div className={c(styles.touchRow, disabled && styles.touchRowDisabled)}>
      {input}
      <span
        className={styles.touchArea}
        aria-hidden
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      />
    </div>
  )
}
