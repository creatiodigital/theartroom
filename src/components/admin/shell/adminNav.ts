import {
  Article,
  Door,
  Gift,
  ImageSquare,
  Invoice,
  ListNumbers,
  ShoppingBag,
  SquaresFour,
  Users,
  Wallet,
  type Icon,
} from '@phosphor-icons/react'

import type { AttentionMetric } from '@/lib/orders/orderBuckets'

export type AdminNavItemDef = {
  label: string
  href: string
  icon: Icon
  /** Orders carries the attention badge (sum of the dashboard's five counts). */
  showsOrdersBadge?: boolean
}

export type AdminNavSection = {
  label: 'Sales' | 'Gallery'
  items: AdminNavItemDef[]
}

export const ADMIN_HOME = '/admin/dashboard'

export const ADMIN_DASHBOARD_ITEM: AdminNavItemDef = {
  label: 'Dashboard',
  href: ADMIN_HOME,
  icon: SquaresFour,
}

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    label: 'Sales',
    items: [
      { label: 'Orders', href: '/admin/orders', icon: ShoppingBag, showsOrdersBadge: true },
      { label: 'Edition sales', href: '/admin/edition-sales', icon: ListNumbers },
      { label: 'Gift orders', href: '/admin/gift-orders', icon: Gift },
      { label: 'Invoices', href: '/admin/invoices', icon: Invoice },
      { label: 'Payouts', href: '/admin/payouts', icon: Wallet },
    ],
  },
  {
    label: 'Gallery',
    items: [
      { label: 'Exhibitions', href: '/admin/exhibitions', icon: Door },
      { label: 'Print presentations', href: '/admin/print-presentations', icon: ImageSquare },
      { label: 'Content', href: '/admin/content', icon: Article },
      { label: 'Users', href: '/admin/users', icon: Users },
    ],
  },
]

/** An item is lit for its own page and everything under it (/admin/orders/123 → Orders). */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export type OrdersBadge = { count: number; tone: 'red' | 'amber'; label: string }

/**
 * The Orders badge: the sum of the five attention counts. Hidden (null) at 0
 * and while the counts are unknown, so a failed read never shows as "nothing
 * to do". Red as soon as money is owed or an order is flagged, amber otherwise.
 */
export function ordersBadge(metrics: Record<AttentionMetric, number> | null): OrdersBadge | null {
  if (!metrics) return null
  const count =
    metrics.refundOwed + metrics.attention + metrics.new + metrics.toPlace + metrics.deliveredUnpaid
  if (count === 0) return null
  return {
    count,
    tone: metrics.refundOwed + metrics.attention > 0 ? 'red' : 'amber',
    label: count === 1 ? '1 order needs attention' : `${count} orders need attention`,
  }
}
