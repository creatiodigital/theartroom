'use client'

import type { ReactNode } from 'react'
import { Info, Warning, type Icon } from '@phosphor-icons/react'
import c from 'classnames'

import styles from './Callout.module.scss'

type CalloutProps = {
  /** info / plain: white; amber: attention; red: something went wrong. */
  tone: 'info' | 'plain' | 'amber' | 'red'
  /**
   * Replaces the tone's icon (Warning for amber / red, Info otherwise), e.g.
   * HandCoins on the payouts reminder. Same size; always the light weight (the
   * filled weight is the warning's).
   */
  icon?: Icon
  /** Bold first sentence. */
  title?: ReactNode
  children?: ReactNode
  /** A button or link after the text (e.g. "Refund the buyer"). */
  action?: ReactNode
}

/** Guidance or warning box: icon, bold first sentence, the rest (orders.md). */
export function Callout({ tone, icon, title, children, action }: CalloutProps) {
  const loud = tone === 'amber' || tone === 'red'
  const CalloutIcon = icon ?? (loud ? Warning : Info)
  return (
    <div role="note" className={c(styles.callout, styles[tone])}>
      <CalloutIcon
        size={18}
        weight={!icon && loud ? 'fill' : 'light'}
        aria-hidden
        className={styles.icon}
      />
      <div className={styles.body}>
        <span className={styles.text}>
          {title && <strong>{title}</strong>}
          {title && children ? ' ' : null}
          {children}
        </span>
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </div>
  )
}
