'use client'

import c from 'classnames'
import type { ChangeEventHandler } from 'react'

import styles from './Checkbox.module.scss'

type CheckboxProps = {
  checked: boolean
  onChange: ChangeEventHandler<HTMLInputElement>
  label?: string
  className?: string
  disabled?: boolean
}

const Checkbox = ({ checked = false, onChange, label, className, disabled }: CheckboxProps) => {
  return (
    <label className={c(styles.checkbox, className)} style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
      <input type="checkbox" checked={checked} onChange={onChange} className={styles.hidden} disabled={disabled} />
      <span className={styles.span}></span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  )
}

export default Checkbox
