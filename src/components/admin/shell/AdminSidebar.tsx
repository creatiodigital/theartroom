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
  ADMIN_HOME,
  ADMIN_NAV_SECTIONS,
  isNavItemActive,
  ordersBadge,
  showsDeveloperSection,
} from './adminNav'
import { ShellSidebar } from './ShellSidebar'
import { ShellWordmark } from './ShellWordmark'
import { StorefrontSwitch } from './StorefrontSwitch'

import styles from './AdminSidebar.module.scss'

/** The dark side menu, 900 px and up. dashboard.dc.html, `<nav aria-label="Admin">`. */
export function AdminSidebar() {
  const pathname = usePathname() ?? ''
  const { metrics } = useAttentionCounts()
  const badge = ordersBadge(metrics)
  const { data: session } = useSession()
  const showsDeveloper = showsDeveloperSection(session?.user?.userType)

  return (
    <ShellSidebar tone="dark" label="Admin">
      <ShellWordmark href={ADMIN_HOME} tag="Admin" tone="dark" size="menu" layout="stacked" />

      <div className={styles.group}>
        <AdminNavItem
          item={ADMIN_DASHBOARD_ITEM}
          active={isNavItemActive(pathname, ADMIN_DASHBOARD_ITEM.href)}
        />
      </div>

      {ADMIN_NAV_SECTIONS.map((section) => (
        <div key={section.label} className={styles.group}>
          <span className={styles.groupLabel}>{section.label}</span>
          {section.items.map((item) => (
            <AdminNavItem
              key={item.href}
              item={item}
              active={isNavItemActive(pathname, item.href)}
              badge={item.showsOrdersBadge ? badge : null}
            />
          ))}
        </div>
      ))}

      <StorefrontSwitch />

      {/* The foot: the Developer group sits on the user card, both at the bottom. */}
      <div className={styles.foot}>
        {showsDeveloper && (
          <div className={c(styles.group, styles.developer)}>
            <span className={styles.groupLabel}>{ADMIN_DEVELOPER_SECTION.label}</span>
            {ADMIN_DEVELOPER_SECTION.items.map((item) => (
              <AdminNavItem
                key={item.href}
                item={item}
                active={isNavItemActive(pathname, item.href)}
              />
            ))}
          </div>
        )}
        <AdminUserCard layout="sidebar" />
      </div>
    </ShellSidebar>
  )
}
