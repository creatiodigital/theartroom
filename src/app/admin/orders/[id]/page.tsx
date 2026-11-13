import type { Metadata } from 'next'

import { AdminOrderDetail } from '@/components/admin/orders/detail/AdminOrderDetail'

export const metadata: Metadata = {
  title: { absolute: 'Order — The Art Room Admin' },
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ id: string }>
}

const AdminOrderPage = async ({ params }: PageProps) => {
  const { id } = await params
  return <AdminOrderDetail orderId={id} />
}

export default AdminOrderPage
