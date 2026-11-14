'use client'

import { Text } from '@/components/ui/Typography'

import c from 'classnames'

import styles from './EmptyState.module.scss'

type EmptyStateProps = {
  message: string
  className?: string
  /** The client side's square corners (owner, 2026-11-14); the dashboard keeps them rounded. */
  squared?: boolean
}

export const EmptyState = ({ message, className, squared = false }: EmptyStateProps) => {
  return (
    <div className={c(styles.empty, squared && styles.squared, className)}>
      <Text as="p">{message}</Text>
    </div>
  )
}
