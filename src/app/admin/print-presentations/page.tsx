import type { Metadata } from 'next'

import { AdminPrintPresentations } from '@/components/admin/print-presentations'

export const metadata: Metadata = {
  title: { absolute: 'Print presentations — The Art Room Admin' },
  robots: { index: false, follow: false },
}

const AdminPrintPresentationsPage = () => <AdminPrintPresentations />

export default AdminPrintPresentationsPage
