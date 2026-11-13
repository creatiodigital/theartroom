import type { ReactNode } from 'react'

import { StudioRouteLayout } from '@/components/dashboard/shell'

// Every studio page shares one frame (side menu, impersonation card). As a
// layout it persists across studio navigation. The login page and the forced
// first-login password screen pass through bare (StudioRouteLayout).
export default function DashboardRouteLayout({ children }: { children: ReactNode }) {
  return <StudioRouteLayout>{children}</StudioRouteLayout>
}
