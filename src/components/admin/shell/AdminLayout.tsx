'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'

import { LoadingBar } from '@/components/ui/LoadingBar'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'

import { AdminMenuDrawer } from './AdminMenuDrawer'
import { AdminShellProvider } from './AdminShellContext'
import { AdminSidebar } from './AdminSidebar'
import { AdminTopBar } from './AdminTopBar'
import { PausedBanner } from './PausedBanner'

import styles from './AdminLayout.module.scss'

// The side menu's breakpoint: `tablet` (900px) in styles/mixins.scss.
const SIDE_MENU_QUERY = '(min-width: 900px)'

/**
 * The frame of every /admin page: side menu (900px and up) or top bar + menu
 * drawer (below), the paused banner, and the page in a centred column.
 * Mounted once by src/app/admin/layout.tsx, so it stays put while the admin
 * moves between pages. Replaces DashboardLayout on admin pages only; the
 * artist dashboard keeps DashboardLayout.
 */
export function AdminLayout({ children }: { children: ReactNode }) {
  const { status: sessionStatus } = useSession()
  const { isImpersonating, stopImpersonation } = useEffectiveUser()
  const router = useRouter()
  const pathname = usePathname() ?? ''

  // Admin pages are always the real admin. Landing on one while an
  // impersonation is still on (Back button, another tab, a typed URL) ends it —
  // but only in a tab the admin is looking at: next-auth tells every open tab
  // when the session changes, and a hidden admin tab ending it would cancel the
  // impersonation the admin just started in another tab.
  // (Copied from DashboardLayout, where the same effect is gated on the
  // pathname being /admin; this layout only ever renders there.)
  const ending = useRef(false)
  useEffect(() => {
    if (!isImpersonating) return
    const endIfSeen = () => {
      if (document.visibilityState !== 'visible' || ending.current) return
      ending.current = true
      void stopImpersonation().finally(() => {
        ending.current = false
      })
    }
    endIfSeen()
    document.addEventListener('visibilitychange', endIfSeen)
    return () => document.removeEventListener('visibilitychange', endIfSeen)
  }, [isImpersonating, stopImpersonation])

  // Redirect to home if not logged in
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    }
  }, [sessionStatus, router])

  // The drawer remembers the page it was opened on, so moving to another
  // page closes it without an effect.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null)
  // A route change that doesn't go through the drawer (browser Back, a swipe)
  // leaves that page behind in state: drop it now, during render, or the
  // drawer would reopen by itself when the admin comes back to that page.
  if (menuOpenOn !== null && menuOpenOn !== pathname) setMenuOpenOn(null)
  const menuOpen = menuOpenOn === pathname
  const openMenu = useCallback(() => setMenuOpenOn(pathname), [pathname])
  const closeMenu = useCallback(() => setMenuOpenOn(null), [])
  const menuButtonRef = useRef<HTMLDivElement>(null)

  // Past 900px the side menu takes over (an iPad turned sideways): an open
  // drawer must close, or the page behind it would stay inert.
  useEffect(() => {
    if (!menuOpen) return
    const query = window.matchMedia(SIDE_MENU_QUERY)
    if (query.matches) {
      closeMenu()
      return
    }
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) closeMenu()
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [menuOpen, closeMenu])

  // While open: the page behind does not scroll; on close, focus goes back
  // to the menu button.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (menuOpen) {
      wasOpen.current = true
      const previous = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = previous
      }
    }
    if (wasOpen.current) {
      wasOpen.current = false
      menuButtonRef.current?.querySelector('button')?.focus()
    }
  }, [menuOpen])

  if (sessionStatus === 'loading') {
    return (
      <div className={styles.loading}>
        <LoadingBar />
      </div>
    )
  }

  // Don't render if unauthenticated (redirect pending)
  if (sessionStatus === 'unauthenticated') {
    return null
  }

  // `root` also holds the shell's pause / resume dialog (rendered by the
  // provider, next to `.shell`), so the keyboard focus ring reaches it too.
  return (
    <div className={styles.root}>
      <AdminShellProvider>
        <div className={styles.shell}>
          <div className={`${styles.sidebarSlot} ${styles.onDark}`}>
            <AdminSidebar />
          </div>

          {/* Everything behind the drawer goes inert while it is open: that is
            what keeps keyboard focus inside the drawer. */}
          <div className={styles.column} inert={menuOpen}>
            <div className={`${styles.topBarSlot} ${styles.onDark}`}>
              <AdminTopBar
                menuOpen={menuOpen}
                onOpenMenu={openMenu}
                menuButtonRef={menuButtonRef}
              />
            </div>
            <main className={styles.main}>
              <div className={styles.onDark}>
                <PausedBanner />
              </div>
              <div className={styles.content}>
                <div className={styles.contentInner}>{children}</div>
              </div>
            </main>
          </div>

          {menuOpen && (
            <div className={styles.onDark}>
              <AdminMenuDrawer onClose={closeMenu} />
            </div>
          )}
        </div>
      </AdminShellProvider>
    </div>
  )
}
