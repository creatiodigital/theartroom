import type { ReactNode } from 'react'

import { AdminLayout } from '@/components/admin/shell'

// Every /admin page shares one frame (side menu, storefront switch, paused
// banner). As a layout it persists across admin navigation, so the menu and its
// data load once per visit instead of once per page.
export default function AdminRouteLayout({ children }: { children: ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>
}
