'use client'

import { useId, type CSSProperties, type ReactNode } from 'react'
import c from 'classnames'

import styles from './AdminSelect.module.scss'

type AdminSelectProps = {
  /** The field's name; visible above the control unless `hideLabel`. */
  label: string
  /** Toolbar filters: the label becomes the select's aria-label. */
  hideLabel?: boolean
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Native tooltip, e.g. why it is disabled. */
  title?: string
  /** Desktop floor width in px (phones go full width). */
  minWidth?: number
  /** The <option>s. */
  children: ReactNode
}

/**
 * A native <select> in the admin look (sales.md §1 toolbar): 36px, 44px under
 * 900px (Q7). Native on purpose: phones get their own picker for free.
 */
export function AdminSelect({
  label,
  hideLabel = false,
  id,
  value,
  onChange,
  disabled = false,
  title,
  minWidth,
  children,
}: AdminSelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId

  const select = (
    <select
      id={selectId}
      className={styles.select}
      value={value}
      disabled={disabled}
      title={title}
      aria-label={hideLabel ? label : undefined}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  )

  return (
    <div
      className={c(styles.field, minWidth !== undefined && styles.floor)}
      // Desktop only (the stylesheet reads it from 900px): phones go full width.
      style={
        minWidth !== undefined
          ? ({ '--select-min-width': `${minWidth}px` } as CSSProperties)
          : undefined
      }
    >
      {!hideLabel && (
        <label htmlFor={selectId} className={styles.label}>
          {label}
        </label>
      )}
      {select}
    </div>
  )
}
