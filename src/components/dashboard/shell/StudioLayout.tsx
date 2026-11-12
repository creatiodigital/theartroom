'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { AdminDialogProvider } from '@/components/admin/shell/AdminDialogContext'
import { ShellFrame } from '@/components/admin/shell/ShellFrame'

import { StudioMenuDrawer } from './StudioMenuDrawer'
import { StudioSidebar } from './StudioSidebar'
import { StudioTopBar } from './StudioTopBar'
import { STUDIO_BARE_PATHS, studioContentWidth } from './studioNav'
import { useRefreshPersonAfterProfile, useStudioImpersonation } from './useStudioShell'

/**
 * Mounted once by src/app/dashboard/layout.tsx. The login page and the forced
 * first-login password screen render bare, as before; every other studio page
 * gets the frame. A child component, so moving from one to the other mounts
 * the frame instead of changing the hooks this one calls.
 */
export function StudioRouteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  if (STUDIO_BARE_PATHS.has(pathname)) return <>{children}</>
  return <StudioLayout>{children}</StudioLayout>
}

/**
 * The artist studio's frame (artist.md §0): the admin's ShellFrame in its light
 * variant. It stays put while the artist moves between studio pages. The
 * dialog layer is there for the admin-look dialogs of steps 15–17.
 */
function StudioLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const impersonation = useStudioImpersonation()
  useRefreshPersonAfterProfile(pathname)

  return (
    <ShellFrame
      variant="studio"
      wrap={(frame) => <AdminDialogProvider>{frame}</AdminDialogProvider>}
      sidebar={<StudioSidebar />}
      topBar={(menu) => <StudioTopBar {...menu} />}
      drawer={(onClose) => <StudioMenuDrawer onClose={onClose} />}
      topLine={impersonation !== null}
      width={studioContentWidth(pathname)}
    >
      {children}
    </ShellFrame>
  )
}
