'use client'

import styles from './AdminCheckbox.module.scss'

type AdminCheckboxProps = {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/**
 * A native checkbox in the admin look (sales.md §2, "Hide delivered"): a 16px
 * box and its label, the whole label a 44px hit area under 900px.
 */
export function AdminCheckbox({ id, label, checked, onChange }: AdminCheckboxProps) {
  return (
    <label htmlFor={id} className={styles.field}>
      <input
        id={id}
        type="checkbox"
        className={styles.box}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}
