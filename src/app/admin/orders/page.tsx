import { Suspense } from 'react'
import type { Metadata } from 'next'

import { AdminOrders } from '@/components/admin/orders'
import { LoadingBar } from '@/components/ui/LoadingBar'

export const metadata: Metadata = {
  title: { absolute: 'Orders — The Art Room Admin' },
  robots: { index: false, follow: false },
}

// The list reads its stage from the URL (?stage=) with useSearchParams, which
// Next requires to sit inside a Suspense boundary.
const AdminOrdersPage = () => (
  <Suspense fallback={<LoadingBar />}>
    <AdminOrders />
  </Suspense>
)

export default AdminOrdersPage
