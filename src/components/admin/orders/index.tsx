'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatEuro } from '@/components/PrintWizard/options'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'

import {
  createSandboxTestOrder,
  listOrders,
  releasePayout,
  type AdminOrderRow,
} from '@/app/admin/orders/actions'

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

// Quick-scan traffic-light palette. Green = healthy, red = attention,
// amber = in flight, grey = not started / terminal-neutral.
const DOT_COLORS: Record<string, string> = {
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  blue: '#3b82f6',
  grey: '#9ca3af',
}

const paymentDot = (status: string): keyof typeof DOT_COLORS => {
  if (status === 'succeeded') return 'green'
  if (status === 'authorized') return 'blue'
  if (status === 'processing') return 'amber'
  if (status === 'failed') return 'red'
  if (status === 'canceled' || status === 'refunded') return 'grey'
  return 'grey'
}

const paymentLabel = (status: string): string => {
  if (status === 'succeeded') return 'Charged'
  if (status === 'authorized') return 'Card held'
  if (status === 'processing') return 'Processing'
  if (status === 'failed') return 'Payment failed'
  if (status === 'canceled') return 'Canceled'
  if (status === 'refunded') return 'Refunded'
  return status
}

const prodigiDot = (stage: string | null): keyof typeof DOT_COLORS => {
  if (stage === 'Complete') return 'green'
  if (stage === 'Rejected' || stage === 'Cancelled') return 'red'
  if (stage === 'Shipped') return 'blue'
  if (stage === 'Started' || stage === 'Placed' || stage === 'InProgress') return 'amber'
  return 'grey'
}

const prodigiStageLabel = (stage: string | null): string => {
  if (!stage) return 'Pending placement'
  if (stage === 'Placed') return 'Placed'
  if (stage === 'Started') return 'In production'
  if (stage === 'Shipped') return 'Shipped'
  if (stage === 'Complete') return 'Complete'
  if (stage === 'Rejected') return 'Rejected'
  return stage
}

const Dot = ({ color }: { color: keyof typeof DOT_COLORS }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: DOT_COLORS[color],
      marginRight: 6,
      verticalAlign: 'middle',
    }}
  />
)

export const AdminOrders = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [confirmPayoutId, setConfirmPayoutId] = useState<string | null>(null)
  const [creatingTestOrder, setCreatingTestOrder] = useState(false)

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

  const handleCreateTestOrder = useCallback(async () => {
    setCreatingTestOrder(true)
    setError(null)
    const res = await createSandboxTestOrder()
    setCreatingTestOrder(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.push(`/admin/orders/${res.orderId}`)
  }, [router])

  const handleRelease = useCallback(
    async (orderId: string) => {
      setReleasingId(orderId)
      setError(null)
      const res = await releasePayout(orderId)
      if (!res.ok) setError(res.error)
      await load()
      setReleasingId(null)
      setConfirmPayoutId(null)
    },
    [load],
  )

  const confirmingOrder = orders.find((o) => o.id === confirmPayoutId) ?? null

  return (
    <DashboardLayout backLink="/admin/dashboard" backLabel="← Back to Admin Dashboard">
      <h1 className={dashboardStyles.pageTitle}>Orders</h1>

      {process.env.NODE_ENV !== 'production' && (
        <div className={dashboardStyles.section}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              background: '#eef2ff',
              border: '1px dashed #6366f1',
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            <span style={{ flex: 1 }}>
              <strong>Dev tools</strong> — create a fake Prodigi sandbox order to exercise the
              full sync + email pipeline without spending money. Hidden in production.
            </span>
            <Button
              font="dashboard"
              variant="secondary"
              label={creatingTestOrder ? 'Creating…' : 'Create sandbox test order'}
              onClick={handleCreateTestOrder}
              disabled={creatingTestOrder}
            />
          </div>
        </div>
      )}

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
                <th>Order</th>
                <th>Buyer</th>
                <th>Total</th>
                <th>Fulfillment</th>
                <th>Artist payout</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(o.createdAt)}</td>
                  <td>
                    <div>{o.artwork.title ?? o.artwork.slug ?? o.artwork.id}</div>
                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 2 }}>
                      {o.artist.name}
                    </div>
                  </td>
                  <td>
                    <div>{o.buyerName}</div>
                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 2 }}>
                      {o.buyerEmail}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div>{formatEuro(o.totalCents)}</div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        opacity: 0.7,
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Dot color={paymentDot(o.paymentStatus)} />
                      {paymentLabel(o.paymentStatus)}
                    </div>
                  </td>
                  <td>
                    <Dot color={prodigiDot(o.prodigiStage)} />
                    <Badge
                      label={prodigiStageLabel(o.prodigiStage)}
                      variant={o.prodigiStage === 'Complete' ? 'published' : 'neutral'}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {(() => {
                      if (o.transferId) {
                        return (
                          <>
                            <Dot color="green" />
                            <span style={{ fontSize: 'var(--text-xs)' }}>
                              {formatEuro(o.artistCents)} paid · {formatDate(o.paidOutAt)}
                            </span>
                          </>
                        )
                      }
                      const eligibleAt = o.payoutEligibleAt
                        ? new Date(o.payoutEligibleAt)
                        : null
                      const eligible = !!eligibleAt && eligibleAt.getTime() <= Date.now()
                      const label =
                        o.prodigiStage !== 'Complete'
                          ? 'Awaiting shipment'
                          : eligible
                            ? 'Ready to release'
                            : `Ready ${eligibleAt ? formatDate(eligibleAt.toISOString()) : 'soon'}`
                      const color: keyof typeof DOT_COLORS =
                        o.prodigiStage !== 'Complete' ? 'grey' : eligible ? 'amber' : 'blue'
                      return (
                        <>
                          <Dot color={color} />
                          <span style={{ fontSize: 'var(--text-xs)' }}>
                            {formatEuro(o.artistCents)} · {label}
                          </span>
                        </>
                      )
                    })()}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {(() => {
                      const eligibleAt = o.payoutEligibleAt
                        ? new Date(o.payoutEligibleAt)
                        : null
                      const eligible = !!eligibleAt && eligibleAt.getTime() <= Date.now()
                      const canRelease =
                        !o.transferId &&
                        o.prodigiStage === 'Complete' &&
                        o.paymentStatus === 'succeeded' &&
                        o.artist.stripeOnboardingComplete &&
                        eligible
                      return (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Link
                            href={`/admin/orders/${o.id}`}
                            style={{ fontSize: 'var(--text-xs)', textDecoration: 'underline' }}
                          >
                            View details
                          </Link>
                          {canRelease && (
                            <Button
                              font="dashboard"
                              variant="primary"
                              label={releasingId === o.id ? 'Releasing…' : 'Release payout'}
                              onClick={() => setConfirmPayoutId(o.id)}
                              disabled={releasingId !== null}
                            />
                          )}
                        </div>
                      )
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmingOrder && (
        <ConfirmModal
          title="Release payout to artist?"
          message={
            <>
              You&apos;re about to transfer{' '}
              <strong>{formatEuro(confirmingOrder.artistCents)}</strong> to{' '}
              <strong>{confirmingOrder.artist.name}</strong>&apos;s Stripe account for order{' '}
              <code>#{confirmingOrder.id.slice(0, 8)}</code>.
              <br />
              <br />
              This action is final — once released, the money moves to the artist&apos;s balance and
              can&apos;t be pulled back from this dashboard.
            </>
          }
          confirmLabel="Yes, release payout"
          cancelLabel="Cancel"
          busy={releasingId === confirmingOrder.id}
          onConfirm={() => handleRelease(confirmingOrder.id)}
          onCancel={() => setConfirmPayoutId(null)}
        />
      )}
    </DashboardLayout>
  )
}
