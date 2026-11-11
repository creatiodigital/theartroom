'use client'

import Link from 'next/link'
import { List } from '@phosphor-icons/react'
import c from 'classnames'
import type { Ref } from 'react'

import { Button } from '@/components/ui/Button'

import { useAttentionCounts } from './AdminShellContext'
import { ADMIN_HOME, ordersBadge } from './adminNav'

import styles from './AdminTopBar.module.scss'

type AdminTopBarProps = {
  menuOpen: boolean
  onOpenMenu: () => void
  /** Focus returns here when the drawer closes. */
  menuButtonRef: Ref<HTMLDivElement>
}

/** The dark top bar under 900 px. dashboard-phone.dc.html. */
export function AdminTopBar({ menuOpen, onOpenMenu, menuButtonRef }: AdminTopBarProps) {
  const { metrics } = useAttentionCounts()
  const badge = ordersBadge(metrics)

  return (
    <header className={styles.bar}>
      <Link href={ADMIN_HOME} className={styles.wordmark}>
        <span className={styles.wordmarkName}>The Art Room</span>
        <span className={styles.wordmarkTag}>Admin</span>
      </Link>
      {/* Button takes no ref, so a wrapper carries it for the focus return. */}
      <div ref={menuButtonRef} className={styles.menuButtonWrap}>
        <Button
          variant="bare"
          font="dashboard"
          className={styles.menuButton}
          aria-label={badge ? `Open menu, ${badge.label}` : 'Open menu'}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          onClick={onOpenMenu}
        >
          <List size={24} weight="light" aria-hidden />
          {badge && (
            <span aria-hidden className={c(styles.badge, styles[`badge_${badge.tone}`])}>
              {badge.count}
            </span>
          )}
        </Button>
      </div>
    </header>
  )
}
