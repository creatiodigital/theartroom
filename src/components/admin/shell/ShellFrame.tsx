'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import c from 'classnames'

import { LoadingBar } from '@/components/ui/LoadingBar'

import { inertOutside } from './inertOutside'

import styles from './ShellFrame.module.scss'

// The side menu's breakpoint: `tablet` (900px) in styles/mixins.scss.
const SIDE_MENU_QUERY = '(min-width: 900px)'

/** `dark` = the admin's menu, `light` = the artist studio's (artist.md §0). */
export type ShellTone = 'dark' | 'light'

/** What the top bar needs to open the phone drawer. */
export type ShellMenuControls = {
  menuOpen: boolean
  onOpenMenu: () => void
  /** Wraps the menu button (Button takes no ref): focus falls back here when the drawer closes. */
  menuButtonRef: RefObject<HTMLDivElement | null>
}

type ShellFrameProps = {
  /** `admin`: dark slots, 36px top, the 1180px column. `studio`: light, 40px top, `width`. */
  variant: 'admin' | 'studio'
  /** The shell's providers, rendered inside the session gate around the frame. */
  wrap: (frame: ReactNode) => ReactNode
  /** The side menu (900px and up). */
  sidebar: ReactNode
  /** The top bar (below 900px). */
  topBar: (menu: ShellMenuControls) => ReactNode
  /** The phone drawer, rendered only while open. */
  drawer: (onClose: () => void) => ReactNode
  /** Above the content, under the top bar (the admin's paused banner). */
  banner?: ReactNode
  /** The studio's 3px red line while an admin impersonates. */
  topLine?: boolean
  /** Studio only: `list` 1080px, `form` 880px. */
  width?: 'list' | 'form'
  children: ReactNode
}

/**
 * The frame of every admin and studio page: side menu (900px and up) or top
 * bar + menu drawer (below), an optional banner, and the page in a centred
 * column. Owns the session gate and the drawer (focus, inert, scroll lock).
 * AdminLayout and the studio's layout fill its slots.
 */
export function ShellFrame({
  variant,
  wrap,
  sidebar,
  topBar,
  drawer,
  banner,
  topLine = false,
  width,
  children,
}: ShellFrameProps) {
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const pathname = usePathname() ?? ''

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
  // drawer would reopen by itself when the user comes back to that page.
  if (menuOpenOn !== null && menuOpenOn !== pathname) setMenuOpenOn(null)
  const menuOpen = menuOpenOn === pathname
  // The control that opened the drawer (the menu button, or the studio's
  // "Viewing as" pill) gets focus back when it closes.
  const opener = useRef<HTMLElement | null>(null)
  const openMenu = useCallback(() => {
    const active = document.activeElement
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null
    setMenuOpenOn(pathname)
  }, [pathname])
  const closeMenu = useCallback(() => setMenuOpenOn(null), [])
  const menuButtonRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  // `.column` goes inert at render; this also covers what the root layout
  // renders around the shell (skip link, cookie banner), so Tab stays in the drawer.
  useEffect(() => {
    if (!menuOpen || !drawerRef.current) return
    return inertOutside(drawerRef.current)
  }, [menuOpen])

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
  // to what opened the drawer (else the menu button).
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
      const target = opener.current
      opener.current = null
      if (target?.isConnected) target.focus()
      else menuButtonRef.current?.querySelector('button')?.focus()
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

  // Only the admin's menu is dark: its slots get the white focus ring.
  const onDark = variant === 'admin' ? styles.onDark : undefined

  // `root` also holds the shell's dialogs (rendered by the providers, next to
  // `.shell`), so the keyboard focus ring reaches them too.
  return (
    <div className={c(styles.root, variant === 'studio' && styles.studio)}>
      {wrap(
        <div className={c(styles.shell, topLine && styles.topLine)}>
          <div className={c(styles.sidebarSlot, onDark)}>{sidebar}</div>

          {/* Everything behind the drawer goes inert while it is open: that is
            what keeps keyboard focus inside the drawer. */}
          <div className={styles.column} inert={menuOpen}>
            <div className={c(styles.topBarSlot, onDark)}>
              {topBar({ menuOpen, onOpenMenu: openMenu, menuButtonRef })}
            </div>
            <main className={styles.main}>
              {banner && <div className={onDark}>{banner}</div>}
              <div className={styles.content}>
                <div className={c(styles.contentInner, width && styles[width])}>{children}</div>
              </div>
            </main>
          </div>

          {menuOpen && (
            <div ref={drawerRef} className={c(styles.drawerSlot, onDark)}>
              {drawer(closeMenu)}
            </div>
          )}
        </div>,
      )}
    </div>
  )
}
