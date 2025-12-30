'use client'

import c from 'classnames'

import styles from './ErrorText.module.scss'

type ErrorTextProps = {
  children: React.ReactNode
  className?: string
}

export const ErrorText = ({ children, className }: ErrorTextProps) => {
  if (!children) return null
  
  return (
    <p className={c(styles.error, className)}>
      {children}
    </p>
  )
}

export default ErrorText
