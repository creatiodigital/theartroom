'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import { useEffectiveUser } from '@/hooks/useEffectiveUser'

import { AdminMenuDrawer } from './AdminMenuDrawer'
import { AdminShellProvider } from './AdminShellContext'
import { AdminSidebar } from './AdminSidebar'
import { AdminTopBar } from './AdminTopBar'
import { PausedBanner } from './PausedBanner'
import { ShellFrame } from './ShellFrame'

/**
 * The frame of every /admin page: side menu (900px and up) or top bar + menu
 * drawer (below), the paused banner, and the page in a centred column.
 * Mounted once by src/app/admin/layout.tsx, so it stays put while the admin
 * moves between pages. The frame itself (session gate, drawer, column) is
 * ShellFrame, which the artist studio's layout shares.
 */
export function AdminLayout({ children }: { children: ReactNode }) {
  const { isImpersonating, stopImpersonation } = useEffectiveUser()

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

  return (
    <ShellFrame
      variant="admin"
      wrap={(frame) => <AdminShellProvider>{frame}</AdminShellProvider>}
      sidebar={<AdminSidebar />}
      topBar={(menu) => <AdminTopBar {...menu} />}
      drawer={(onClose) => <AdminMenuDrawer onClose={onClose} />}
      banner={<PausedBanner />}
    >
      {children}
    </ShellFrame>
  )
}
