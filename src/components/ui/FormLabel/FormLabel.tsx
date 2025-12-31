'use client'

import c from 'classnames'

import styles from './FormLabel.module.scss'

type FormLabelProps = {
  children: React.ReactNode
  htmlFor?: string
  required?: boolean
  className?: string
}

export const FormLabel = ({ children, htmlFor, required, className }: FormLabelProps) => {
  return (
    <label htmlFor={htmlFor} className={c(styles.label, className)}>
      {children}
      {required && <span className={styles.required}>*</span>}
    </label>
  )
}

export default FormLabel
