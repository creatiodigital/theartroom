'use client'

import type { ReactNode } from 'react'
import { Check, Warning, X } from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import styles from './FeedbackBar.module.scss'

type FeedbackBarProps = {
  /** success: green, `role="status"`; error: red, `role="alert"`. */
  tone: 'success' | 'error'
  children: ReactNode
  /** The × button. */
  onDismiss: () => void
}

/**
 * The result of an action, under the page header (users.md, designs/users.dc.html):
 * icon, the message, a × that hides it.
 */
export function FeedbackBar({ tone, children, onDismiss }: FeedbackBarProps) {
  const success = tone === 'success'
  return (
    <div role={success ? 'status' : 'alert'} className={c(styles.bar, styles[tone])}>
      {success ? (
        <Check size={16} weight="bold" aria-hidden className={styles.icon} />
      ) : (
        <Warning size={16} weight="fill" aria-hidden className={styles.icon} />
      )}
      <span className={styles.text}>{children}</span>
      <Button
        variant="bare"
        font="dashboard"
        className={styles.dismiss}
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <X size={16} weight="light" aria-hidden />
      </Button>
    </div>
  )
}
