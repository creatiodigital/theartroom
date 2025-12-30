'use client'

import c from 'classnames'

import styles from './EmptyState.module.scss'

type EmptyStateProps = {
  message: string
  className?: string
}

export const EmptyState = ({ message, className }: EmptyStateProps) => {
  return (
    <div className={c(styles.empty, className)}>
      <p>{message}</p>
    </div>
  )
}

export default EmptyState
