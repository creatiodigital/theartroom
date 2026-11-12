'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import c from 'classnames'

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
import { ShellDrawer } from './ShellDrawer'
import { ShellWordmark } from './ShellWordmark'

import styles from './AdminMenuDrawer.module.scss'

type AdminMenuDrawerProps = {
  onClose: () => void
}

/**
 * The phone menu: full screen, dark. dashboard-phone-menu.dc.html.
 *
 * The frame (focus on the close button, Escape, the header) is ShellDrawer;
 * the shell makes everything behind it `inert`, which keeps Tab inside it.
 */
export function AdminMenuDrawer({ onClose }: AdminMenuDrawerProps) {
  const pathname = usePathname() ?? ''
  const { metrics } = useAttentionCounts()
  const badge = ordersBadge(metrics)
  const { data: session } = useSession()
  const showsDeveloper = showsDeveloperSection(session?.user?.userType)

  return (
    <ShellDrawer
      tone="dark"
      label="Admin menu"
      wordmark={<ShellWordmark tag="Admin" tone="dark" size="bar" layout="inline" />}
      onClose={onClose}
    >
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
    </ShellDrawer>
  )
}
