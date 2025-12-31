'use client'

import { Text } from '@/components/ui/Typography'

import c from 'classnames'

import styles from './EmptyState.module.scss'

type EmptyStateProps = {
  message: string
  className?: string
}

export const EmptyState = ({ message, className }: EmptyStateProps) => {
  return (
    <div className={c(styles.empty, className)}>
      <Text as="p">{message}</Text>
    </div>
  )
}

export default EmptyState
