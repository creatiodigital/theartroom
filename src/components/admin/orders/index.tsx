'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatEuro } from '@/components/PrintWizard/options'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'

import { listOrders, releasePayout, type AdminOrderRow } from '@/app/admin/orders/actions'

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export const AdminOrders = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [releasingId, setReleasingId] = useState<string | null>(null)

  // Redirect non-admins (same guard used by other admin pages).
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const userType = session?.user?.userType
      if (userType !== 'admin' && userType !== 'superAdmin') router.push('/')
    }
  }, [sessionStatus, session, router])

  const load = useCallback(async () => {
    setError(null)
    const res = await listOrders()
    if (res.ok) setOrders(res.orders)
    else setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (sessionStatus === 'authenticated') load()
  }, [sessionStatus, load])

  const handleRelease = useCallback(
    async (orderId: string) => {
      setReleasingId(orderId)
      setError(null)
      const res = await releasePayout(orderId)
      if (!res.ok) setError(res.error)
      await load()
      setReleasingId(null)
    },
    [load],
  )

  return (
    <DashboardLayout backLink="/admin/dashboard" backLabel="← Back to Admin Dashboard">
      <h1 className={dashboardStyles.pageTitle}>Orders</h1>

      {error && (
        <div className={dashboardStyles.section}>
          <p className={dashboardStyles.sectionDescription}>⚠️ {error}</p>
        </div>
      )}

      <div className={dashboardStyles.section}>
        {loading ? (
          <p className={dashboardStyles.sectionDescription}>Loading…</p>
        ) : orders.length === 0 ? (
          <EmptyState message="No print orders yet." />
        ) : (
          <table className={dashboardStyles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Artwork</th>
                <th>Artist</th>
                <th>Buyer</th>
                <th>Payment</th>
                <th>Prodigi</th>
                <th>Tracking</th>
                <th>Artist payout</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>{o.artwork.title ?? o.artwork.slug ?? o.artwork.id}</td>
                  <td>{o.artist.name}</td>
                  <td>
                    <div>{o.buyerName}</div>
                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>{o.buyerEmail}</div>
                  </td>
                  <td>
                    <Badge
                      label={o.paymentStatus}
                      variant={o.paymentStatus === 'succeeded' ? 'published' : 'unpublished'}
                    />
                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 4 }}>
                      {formatEuro(o.totalCents)}
                    </div>
                  </td>
                  <td>
                    <Badge
                      label={o.prodigiStage ?? 'pending'}
                      variant={o.prodigiStage === 'Complete' ? 'published' : 'current'}
                    />
                    {o.prodigiOrderId && (
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 4 }}>
                        {o.prodigiOrderId}
                      </div>
                    )}
                  </td>
                  <td>
                    {o.trackingUrl ? (
                      <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer">
                        Track
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {o.transferId ? (
                      <>
                        <Badge label="Paid" variant="published" />
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 4 }}>
                          {formatEuro(o.artistCents)} · {formatDate(o.paidOutAt)}
                        </div>
                      </>
                    ) : (
                      <>
                        <Badge
                          label={o.prodigiStage === 'Complete' ? 'Ready' : 'Awaiting shipment'}
                          variant={o.prodigiStage === 'Complete' ? 'current' : 'unpublished'}
                        />
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 4 }}>
                          {formatEuro(o.artistCents)}
                        </div>
                      </>
                    )}
                  </td>
                  <td>
                    {!o.transferId && (
                      <Button
                        font="dashboard"
                        variant="primary"
                        label={releasingId === o.id ? 'Releasing…' : 'Release payout'}
                        onClick={() => handleRelease(o.id)}
                        disabled={
                          releasingId !== null ||
                          o.prodigiStage !== 'Complete' ||
                          o.paymentStatus !== 'succeeded' ||
                          !o.artist.stripeOnboardingComplete
                        }
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  )
}
