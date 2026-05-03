import type { Metadata } from 'next'

import { AdminOrders } from '@/components/admin/orders'

export const metadata: Metadata = {
  title: { absolute: 'Orders — The Art Room Admin' },
  robots: { index: false, follow: false },
}

const AdminOrdersPage = () => <AdminOrders />

export default AdminOrdersPage
