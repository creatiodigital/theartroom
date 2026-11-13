'use client'

import { Eye } from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import styles from './ImpersonationCard.module.scss'

type ImpersonationCardProps = {
  /** The impersonated user's full name. */
  name: string
  onStop: () => void
  /** `drawer`: the phone drawer, where Stop is 44px tall (questions.md Q7). */
  layout: 'sidebar' | 'drawer'
}

/**
 * Replaces the old red "Viewing as … / Stop Impersonating" bar: at the top of
 * the studio menu and of the phone drawer. artist-home.dc.html (`impersonating`).
 */
export function ImpersonationCard({ name, onStop, layout }: ImpersonationCardProps) {
  return (
    <div role="status" className={c(styles.card, styles[layout])}>
      <span className={styles.head}>
        <span aria-hidden className={styles.mark}>
          <Eye size={16} weight="fill" aria-hidden />
        </span>
        {/* The space keeps the text "Viewing as {name}" for search and screen readers. */}
        <span className={styles.who}>
          <span className={styles.label}>Viewing as</span>{' '}
          <span className={styles.name}>{name}</span>
        </span>
      </span>
      <span className={styles.line}>
        You’re signed in as an admin. Changes save to this account.
      </span>
      <Button
        variant="bare"
        font="dashboard"
        className={styles.stop}
        label="Stop impersonating"
        onClick={onStop}
      />
    </div>
  )
}
