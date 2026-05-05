'use client'

import c from 'classnames'
import type { ChangeEventHandler } from 'react'

import styles from './Toggle.module.scss'

type ToggleProps = {
  checked: boolean
  onChange: ChangeEventHandler<HTMLInputElement>
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

/**
 * iOS-style toggle switch — visually distinct from `Checkbox` (which is a
 * square checkmark). Used by editor panels for on/off settings (human
 * reference, lamp enabled, window transparency, etc.).
 */
export const Toggle = ({
  checked,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: ToggleProps) => {
  return (
    <label className={c(styles.toggle, className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <span className={styles.slider} />
    </label>
  )
}

export default Toggle
