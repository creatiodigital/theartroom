'use client'

import type { ReactNode } from 'react'

import styles from './AdminCheckbox.module.scss'

type AdminCheckboxProps = {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /**
   * A line under the label (e.g. the artwork editor's "Feature on artist
   * profile"), tied to the box with aria-describedby and kept out of its name.
   */
  description?: ReactNode
}

/**
 * A native checkbox in the admin look (sales.md §2, "Hide delivered"): a 16px
 * box and its label, the whole label a 44px hit area under 900px.
 */
export function AdminCheckbox({ id, label, checked, onChange, description }: AdminCheckboxProps) {
  const field = (
    <label htmlFor={id} className={styles.field}>
      <input
        id={id}
        type="checkbox"
        className={styles.box}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={description ? `${id}-description` : undefined}
      />
      {label}
    </label>
  )

  if (!description) return field

  return (
    <div className={styles.withDescription}>
      {field}
      <span id={`${id}-description`} className={styles.description}>
        {description}
      </span>
    </div>
  )
}
