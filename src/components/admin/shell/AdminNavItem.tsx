'use client'

import Link from 'next/link'
import c from 'classnames'

import type { AdminNavItemDef, OrdersBadge } from './adminNav'
import { blurOnPointerClick } from './blurOnPointerClick'
import type { ShellTone } from './ShellFrame'

import styles from './AdminNavItem.module.scss'

type AdminNavItemProps = {
  item: AdminNavItemDef
  active: boolean
  /** Only Orders passes one; null/undefined hides it. */
  badge?: OrdersBadge | null
  /** `menu` = side menu (18 px icon), `drawer` = phone drawer (48 px tall, 20 px icon). */
  size?: 'menu' | 'drawer'
  /** The drawer closes itself on any item, the current page included (no route change then). */
  onNavigate?: () => void
  /** `dark` = the admin's menu (default); `light` = the artist studio's (artist.md §0). */
  tone?: ShellTone
}

type NavItemClassOptions = {
  tone?: ShellTone
  size?: 'menu' | 'drawer'
  compact?: boolean
  active: boolean
}

/**
 * A menu row's classes. Exported for a row that is a button rather than a
 * link (the studio's Log out), so it looks and behaves like the others.
 */
export function navItemClassName({
  tone = 'dark',
  size = 'menu',
  compact = false,
  active,
}: NavItemClassOptions): string {
  return c(
    styles.item,
    tone === 'light' && styles.light,
    compact && styles.compact,
    styles[size],
    active && styles.active,
  )
}

// 18 px in the side menu, 20 px in the drawer; a compact item's icon is 2 px smaller.
const ICON_SIZE = { menu: 18, drawer: 20 } as const

export function AdminNavItem({
  item,
  active,
  badge,
  size = 'menu',
  onNavigate,
  tone = 'dark',
}: AdminNavItemProps) {
  const ItemIcon = item.icon
  return (
    <Link
      href={item.href}
      onClick={(event) => {
        blurOnPointerClick(event)
        onNavigate?.()
      }}
      aria-current={active ? 'page' : undefined}
      className={navItemClassName({ tone, size, compact: item.compact, active })}
    >
      <ItemIcon
        size={ICON_SIZE[size] - (item.compact ? 2 : 0)}
        weight={active ? 'fill' : 'light'}
        aria-hidden
      />
      <span className={styles.label}>{item.label}</span>
      {badge && (
        <>
          <span aria-hidden className={c(styles.badge, styles[`badge_${badge.tone}`])}>
            {badge.count}
          </span>
          <span className="sr-only">, {badge.label}</span>
        </>
      )}
    </Link>
  )
}
