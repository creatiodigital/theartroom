'use client'

import type { ReactNode } from 'react'
import { Tray } from '@phosphor-icons/react'

import styles from './EmptyState.module.scss'

type EmptyStateProps = {
  title: string
  /** One secondary line (optional); may carry a <strong> name of a control. */
  text?: ReactNode
  /** A button under the text, e.g. "Clear" when filters hide everything. */
  action?: ReactNode
}

/** Empty list inside a panel (orders.md §1): tray in a circle, bold title, one line. */
export function EmptyState({ title, text, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span aria-hidden className={styles.icon}>
        <Tray size={20} weight="light" />
      </span>
      <strong className={styles.title}>{title}</strong>
      {text && <span className={styles.text}>{text}</span>}
      {action}
    </div>
  )
}
