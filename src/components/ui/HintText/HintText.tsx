'use client'

import c from 'classnames'

import styles from './HintText.module.scss'

type HintTextProps = {
  children: React.ReactNode
  className?: string
}

export const HintText = ({ children, className }: HintTextProps) => {
  if (!children) return null

  return <span className={c(styles.hint, className)}>{children}</span>
}

export default HintText
