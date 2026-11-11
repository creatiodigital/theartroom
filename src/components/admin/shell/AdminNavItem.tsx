'use client'

import Link from 'next/link'
import c from 'classnames'

import type { AdminNavItemDef, OrdersBadge } from './adminNav'
import { blurOnPointerClick } from './blurOnPointerClick'

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
}

// 18 px in the side menu, 20 px in the drawer; a compact item's icon is 2 px smaller.
const ICON_SIZE = { menu: 18, drawer: 20 } as const

export function AdminNavItem({
  item,
  active,
  badge,
  size = 'menu',
  onNavigate,
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
      className={c(
        styles.item,
        item.compact && styles.compact,
        styles[size],
        active && styles.active,
      )}
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
