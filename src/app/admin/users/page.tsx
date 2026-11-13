import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AdminUsers } from '@/components/admin/AdminUsers'

export const metadata: Metadata = {
  title: { absolute: 'Users — The Art Room Admin' },
  robots: { index: false, follow: false },
}

// AdminUsers reads `useSearchParams()` (the ?type= filter), which needs a
// Suspense boundary so prerender can bail out cleanly.
const AdminUsersPage = () => (
  <Suspense fallback={null}>
    <AdminUsers />
  </Suspense>
)

export default AdminUsersPage
