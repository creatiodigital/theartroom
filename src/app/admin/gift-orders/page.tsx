import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AdminGiftOrders } from '@/components/admin/gift-orders'

export const metadata: Metadata = {
  title: { absolute: 'Gift orders — The Art Room Admin' },
  robots: { index: false, follow: false },
}

// AdminGiftOrders reads `useSearchParams()` (the ?kind= filter), which needs a
// Suspense boundary so prerender can bail out cleanly.
const AdminGiftOrdersPage = () => (
  <Suspense fallback={null}>
    <AdminGiftOrders />
  </Suspense>
)

export default AdminGiftOrdersPage
