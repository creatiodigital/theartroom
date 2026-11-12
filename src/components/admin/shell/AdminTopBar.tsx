'use client'

import c from 'classnames'
import type { Ref } from 'react'

import { useAttentionCounts } from './AdminShellContext'
import { ADMIN_HOME, ordersBadge } from './adminNav'
import { ShellTopBar } from './ShellTopBar'
import { ShellWordmark } from './ShellWordmark'

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
    <ShellTopBar
      tone="dark"
      wordmark={
        <ShellWordmark href={ADMIN_HOME} tag="Admin" tone="dark" size="bar" layout="inline" />
      }
      menuLabel={badge ? `Open menu, ${badge.label}` : 'Open menu'}
      menuBadge={
        badge && (
          <span aria-hidden className={c(styles.badge, styles[`badge_${badge.tone}`])}>
            {badge.count}
          </span>
        )
      }
      menuOpen={menuOpen}
      onOpenMenu={onOpenMenu}
      menuButtonRef={menuButtonRef}
    />
  )
}
