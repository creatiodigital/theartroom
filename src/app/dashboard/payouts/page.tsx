import type { Metadata } from 'next'

import { PayoutsPage } from '@/components/dashboard/Payouts'

export const metadata: Metadata = {
  title: { absolute: 'Payouts — The Art Room' },
  robots: { index: false, follow: false },
}

const Payouts = () => <PayoutsPage />

export default Payouts
