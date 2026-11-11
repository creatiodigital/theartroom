'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { X } from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import { AdminNavItem } from './AdminNavItem'
import { AdminUserCard } from './AdminUserCard'
import { useAttentionCounts } from './AdminShellContext'
import {
  ADMIN_DASHBOARD_ITEM,
  ADMIN_DEVELOPER_SECTION,
  ADMIN_NAV_SECTIONS,
  isNavItemActive,
  ordersBadge,
  showsDeveloperSection,
} from './adminNav'

import styles from './AdminMenuDrawer.module.scss'

type AdminMenuDrawerProps = {
  onClose: () => void
}

/**
 * The phone menu: full screen, dark. dashboard-phone-menu.dc.html.
 *
 * Focus moves to the close button on open. The shell makes everything behind
 * the drawer `inert` while it is open, which is what keeps Tab inside it.
 */
export function AdminMenuDrawer({ onClose }: AdminMenuDrawerProps) {
  const pathname = usePathname() ?? ''
  const { metrics } = useAttentionCounts()
  const badge = ordersBadge(metrics)
  const { data: session } = useSession()
  const showsDeveloper = showsDeveloperSection(session?.user?.userType)
  const closeWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    closeWrapRef.current?.querySelector('button')?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label="Admin menu" className={styles.drawer}>
      <div className={styles.header}>
        <span className={styles.wordmark}>
          <span className={styles.wordmarkName}>The Art Room</span>
          <span className={styles.wordmarkTag}>Admin</span>
        </span>
        <div ref={closeWrapRef} className={styles.closeWrap}>
          <Button
            variant="bare"
            font="dashboard"
            className={styles.close}
            aria-label="Close menu"
            onClick={onClose}
          >
            <X size={24} weight="light" aria-hidden />
          </Button>
        </div>
      </div>

      <nav aria-label="Admin" className={styles.nav}>
        <AdminNavItem
          item={ADMIN_DASHBOARD_ITEM}
          active={isNavItemActive(pathname, ADMIN_DASHBOARD_ITEM.href)}
          size="drawer"
          onNavigate={onClose}
        />
        {ADMIN_NAV_SECTIONS.map((section) => (
          <div key={section.label} className={styles.group}>
            <span className={styles.groupLabel}>{section.label}</span>
            {section.items.map((item) => (
              <AdminNavItem
                key={item.href}
                item={item}
                active={isNavItemActive(pathname, item.href)}
                badge={item.showsOrdersBadge ? badge : null}
                size="drawer"
                onNavigate={onClose}
              />
            ))}
          </div>
        ))}
        {showsDeveloper && (
          <div className={c(styles.group, styles.developer)}>
            <span className={styles.groupLabel}>{ADMIN_DEVELOPER_SECTION.label}</span>
            {ADMIN_DEVELOPER_SECTION.items.map((item) => (
              <AdminNavItem
                key={item.href}
                item={item}
                active={isNavItemActive(pathname, item.href)}
                size="drawer"
                onNavigate={onClose}
              />
            ))}
          </div>
        )}
      </nav>

      <AdminUserCard layout="drawer" />
    </div>
  )
}
