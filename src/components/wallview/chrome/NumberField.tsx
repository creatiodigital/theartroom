'use client'

import { NumberInput } from '@/components/ui/NumberInput'
import type { NumberInputProps } from '@/components/ui/NumberInput/NumberInput'

import styles from './Field.module.scss'

type NumberFieldProps = { label: string } & Omit<NumberInputProps, 'aria-label'>

/** A caption over the wall view's number field; the <label> names the input. */
export function NumberField({ label, ...input }: NumberFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <NumberInput {...input} />
    </label>
  )
}
