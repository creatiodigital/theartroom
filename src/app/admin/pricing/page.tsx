import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { auth } from '@/auth'
import { AdminPricing } from '@/components/admin/pricing'
import { isAdminOrAbove } from '@/lib/authUtils'
import { getGalleryCommission } from '@/lib/settings'

export const metadata: Metadata = {
  title: { absolute: 'Pricing — The Art Room Admin' },
  robots: { index: false, follow: false },
}

// The commission as stored right now, never a cached copy.
export const dynamic = 'force-dynamic'

/**
 * Admin › Sales › Pricing (docs/admin-redesign/pricing.md): the gallery's commissions (open and
 * limited editions). Admins only —
 * the proxy keeps /admin to admins, and this page checks again before reading anything.
 */
export default async function AdminPricingPage() {
  const session = await auth()
  if (!isAdminOrAbove(session?.user?.userType)) notFound()

  const commission = await getGalleryCommission()
  return (
    <AdminPricing
      pct={commission.pct}
      limitedPct={commission.limitedPct}
      changedAt={commission.changedAt?.toISOString() ?? null}
      readFailed={commission.readFailed}
    />
  )
}
