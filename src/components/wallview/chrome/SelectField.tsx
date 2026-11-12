'use client'

import { useId } from 'react'

import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select/Select'

import styles from './Field.module.scss'

type SelectFieldProps<T extends string | number> = {
  /** The visible name above the select; with `hideLabel`, its accessible name only. */
  label: string
  hideLabel?: boolean
  /** Only where the label needs context to be told apart (questions.md Q135). */
  ariaLabel?: string
  options: SelectOption<T>[]
  value: T | undefined
  /** The panel's own handler, unchanged. */
  onChange: (value: T) => void
  disabled?: boolean
}

/** A caption and today's dropdown in the editor look (`ui/Select tone="editor"`). */
export function SelectField<T extends string | number>({
  label,
  hideLabel = false,
  ariaLabel,
  options,
  value,
  onChange,
  disabled,
}: SelectFieldProps<T>) {
  const labelId = useId()
  const named = ariaLabel ?? (hideLabel ? label : undefined)

  return (
    <div className={styles.field}>
      {!hideLabel && (
        <span id={labelId} className={styles.label}>
          {label}
        </span>
      )}
      <Select<T>
        tone="editor"
        options={options}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label={named}
        aria-labelledby={named ? undefined : labelId}
      />
    </div>
  )
}
