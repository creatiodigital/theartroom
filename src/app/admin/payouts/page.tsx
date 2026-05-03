import type { Metadata } from 'next'

import { AdminPayouts } from '@/components/admin/payouts'

export const metadata: Metadata = {
  title: { absolute: 'Artist payouts — The Art Room Admin' },
  robots: { index: false, follow: false },
}

const AdminPayoutsPage = () => <AdminPayouts />

export default AdminPayoutsPage
