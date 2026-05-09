'use client'

import c from 'classnames'

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
}

/**
 * Numeric range slider used by the editor panels (lighting, floor, human,
 * camera, wall/ceiling, presentation, artwork transforms, etc.). The styling
 * lives here once instead of being duplicated across every panel's
 * stylesheet.
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
}: SliderProps) => {
  return (
    <input
      type="range"
      className={c(styles.slider, className)}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  )
}

export default Slider
