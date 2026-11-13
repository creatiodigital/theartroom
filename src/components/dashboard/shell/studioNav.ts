import { Bank, House, Images, Key, User } from '@phosphor-icons/react'

import { isNavItemActive, type AdminNavItemDef } from '@/components/admin/shell/adminNav'

export const STUDIO_HOME = '/dashboard'

/**
 * Studio routes that render without the frame: the login page (the same exact
 * match as proxy.ts) and the forced first-login password screen, which stays
 * as it is (questions.md Q100).
 */
export const STUDIO_BARE_PATHS: ReadonlySet<string> = new Set([
  '/dashboard/login',
  '/dashboard/change-password',
])

/** The studio menu (artist.md §0), in order. */
export const STUDIO_NAV_ITEMS: AdminNavItemDef[] = [
  { label: 'Home', href: STUDIO_HOME, icon: House },
  { label: 'Artworks', href: '/dashboard/artworks', icon: Images },
  { label: 'Profile', href: '/dashboard/profile', icon: User },
  { label: 'Payouts', href: '/dashboard/payouts', icon: Bank },
]

/** A quiet row at the foot of the menu. */
export const CHANGE_PASSWORD_ITEM: AdminNavItemDef = {
  label: 'Change password',
  href: '/dashboard/change-password',
  icon: Key,
  compact: true,
}

export const PROFILE_PATH = '/dashboard/profile'

const EXHIBITIONS_PREFIX = '/dashboard/exhibitions/'

/**
 * Home is lit on its own page and on an exhibition's settings (artist.md §0);
 * it never uses the prefix rule, or it would light on every studio page.
 * Everything else lights for its page and what is under it, so the artwork
 * editor keeps Artworks lit.
 */
export function isStudioItemActive(pathname: string, href: string): boolean {
  if (href === STUDIO_HOME) {
    return pathname === STUDIO_HOME || pathname.startsWith(EXHIBITIONS_PREFIX)
  }
  return isNavItemActive(pathname, href)
}

const FORM_PAGES: ReadonlySet<string> = new Set([PROFILE_PATH, '/dashboard/payouts'])
const EXHIBITION_SETTINGS = /^\/dashboard\/exhibitions\/[^/]+\/settings$/

/** The content column (artist.md §0): 880px for the form pages, 1080px for the rest. */
export function studioContentWidth(pathname: string): 'list' | 'form' {
  return FORM_PAGES.has(pathname) || EXHIBITION_SETTINGS.test(pathname) ? 'form' : 'list'
}
