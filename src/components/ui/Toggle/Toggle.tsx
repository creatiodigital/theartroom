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
  /**
   * default: the 32×18 switch of the editor panels and announcements.
   * admin: the admin look (docs/admin-redesign/gallery.md §1): 40×24 with an
   * 18px knob, `role="switch"`, a keyboard focus ring and a 44px hit area
   * under 900px.
   */
  tone?: 'default' | 'admin'
  /** The input's id, for a visible `<label htmlFor>`. */
  id?: string
  /** The visible name and line, when there is one (instead of `aria-label`). */
  'aria-labelledby'?: string
  'aria-describedby'?: string
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
  tone = 'default',
  id,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: ToggleProps) => {
  return (
    <label className={c(styles.toggle, tone === 'admin' && styles.admin, className)}>
      <input
        type="checkbox"
        id={id}
        role={tone === 'admin' ? 'switch' : undefined}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
      />
      <span className={styles.slider} />
    </label>
  )
}
