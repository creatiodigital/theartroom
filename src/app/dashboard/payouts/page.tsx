import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PayoutsPage } from '@/components/dashboard/Payouts'

export const metadata: Metadata = {
  title: { absolute: 'Payouts — The Art Room' },
  robots: { index: false, follow: false },
}

// PayoutsPage reads `useSearchParams()` internally, which forces Next.js
// to require a Suspense boundary so prerender can bail out cleanly.
const Payouts = () => (
  <Suspense fallback={null}>
    <PayoutsPage />
  </Suspense>
)

export default Payouts
