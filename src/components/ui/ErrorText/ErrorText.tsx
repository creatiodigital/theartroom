'use client'

import c from 'classnames'

import { Text } from '@/components/ui/Typography'

import styles from './ErrorText.module.scss'

type ErrorTextProps = {
  children: React.ReactNode
  className?: string
}

export const ErrorText = ({ children, className }: ErrorTextProps) => {
  if (!children) return null

  return (
    <Text as="p" className={c(styles.error, className)}>
      {children}
    </Text>
  )
}

export default ErrorText
