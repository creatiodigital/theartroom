'use client'

import { Tray } from '@phosphor-icons/react'

import styles from './EmptyState.module.scss'

type EmptyStateProps = {
  title: string
  /** One secondary line (optional). */
  text?: string
}

/** Empty list inside a panel (orders.md §1): tray in a circle, bold title, one line. */
export function EmptyState({ title, text }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span aria-hidden className={styles.icon}>
        <Tray size={20} weight="light" />
      </span>
      <strong className={styles.title}>{title}</strong>
      {text && <span className={styles.text}>{text}</span>}
    </div>
  )
}
