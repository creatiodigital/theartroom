'use client'

import { MagnifyingGlass } from '@phosphor-icons/react'

import styles from './SearchField.module.scss'

type SearchFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Spoken name of the field (visually hidden). */
  label: string
}

/** Search box with the magnifier inside (orders.md §1 toolbar). */
export function SearchField({ value, onChange, placeholder, label }: SearchFieldProps) {
  return (
    <label className={styles.field}>
      <span className="sr-only">{label}</span>
      <MagnifyingGlass size={16} weight="light" aria-hidden className={styles.icon} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={styles.input}
      />
    </label>
  )
}
