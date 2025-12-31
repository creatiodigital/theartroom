'use client'

import c from 'classnames'

import styles from './ButtonGroup.module.scss'

type ButtonGroupProps = {
  children: React.ReactNode
  className?: string
  align?: 'left' | 'center' | 'right'
}

export const ButtonGroup = ({ children, className, align = 'left' }: ButtonGroupProps) => {
  return <div className={c(styles.group, styles[align], className)}>{children}</div>
}

export default ButtonGroup
