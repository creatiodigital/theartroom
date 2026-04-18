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

import { listOrders, releasePayout, type AdminOrderRow } from '@/app/admin/orders/actions'

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

const formatRelative = (iso: string | null) => {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
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

const prodigiDot = (stage: string | null): keyof typeof DOT_COLORS => {
  if (stage === 'Complete') return 'green'
  if (stage === 'Cancelled') return 'red'
  if (stage === 'InProgress') return 'amber'
  return 'grey'
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
      setConfirmPayoutId(null)
    },
    [load],
  )

  const confirmingOrder = orders.find((o) => o.id === confirmPayoutId) ?? null

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
                <th>Latest event</th>
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
                    <span>
                      <Dot color={paymentDot(o.paymentStatus)} />
                      <Badge
                        label={o.paymentStatus}
                        variant={o.paymentStatus === 'succeeded' ? 'published' : 'unpublished'}
                      />
                    </span>
                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 4 }}>
                      {formatEuro(o.totalCents)}
                    </div>
                  </td>
                  <td>
                    <span>
                      <Dot color={prodigiDot(o.prodigiStage)} />
                      <Badge
                        label={o.prodigiStage ?? 'pending'}
                        variant={o.prodigiStage === 'Complete' ? 'published' : 'current'}
                      />
                    </span>
                    {o.prodigiOrderId && (
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 4 }}>
                        {o.prodigiOrderId}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)' }}>
                    {o.latestEvent ? (
                      <>
                        <div>{o.latestEvent.message ?? o.latestEvent.kind}</div>
                        <div style={{ opacity: 0.6, marginTop: 2 }}>
                          {formatRelative(o.latestEvent.at)}
                        </div>
                      </>
                    ) : (
                      '—'
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
                        <span>
                          <Dot color="green" />
                          <Badge label="Paid" variant="published" />
                        </span>
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 4 }}>
                          {formatEuro(o.artistCents)} · {formatDate(o.paidOutAt)}
                        </div>
                      </>
                    ) : (
                      <>
                        {(() => {
                          const eligibleAt = o.payoutEligibleAt
                            ? new Date(o.payoutEligibleAt)
                            : null
                          const eligible = !!eligibleAt && eligibleAt.getTime() <= Date.now()
                          const statusLabel =
                            o.prodigiStage !== 'Complete'
                              ? 'Awaiting shipment'
                              : eligible
                                ? 'Ready'
                                : 'Holding'
                          const statusColor: keyof typeof DOT_COLORS =
                            o.prodigiStage !== 'Complete' ? 'grey' : eligible ? 'amber' : 'blue'
                          return (
                            <>
                              <span>
                                <Dot color={statusColor} />
                                <Badge label={statusLabel} variant="current" />
                              </span>
                              {eligibleAt && !eligible && (
                                <div
                                  style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 4 }}
                                >
                                  Eligible {formatDate(eligibleAt.toISOString())}
                                </div>
                              )}
                              <div
                                style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 4 }}
                              >
                                {formatEuro(o.artistCents)}
                              </div>
                            </>
                          )
                        })()}
                      </>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        style={{ fontSize: 'var(--text-xs)', textDecoration: 'underline' }}
                      >
                        View details
                      </Link>
                      {!o.transferId &&
                        (() => {
                          const eligibleAt = o.payoutEligibleAt
                            ? new Date(o.payoutEligibleAt)
                            : null
                          const eligible = !!eligibleAt && eligibleAt.getTime() <= Date.now()
                          return (
                            <Button
                              font="dashboard"
                              variant="primary"
                              label={releasingId === o.id ? 'Releasing…' : 'Release payout'}
                              onClick={() => setConfirmPayoutId(o.id)}
                              disabled={
                                releasingId !== null ||
                                o.prodigiStage !== 'Complete' ||
                                o.paymentStatus !== 'succeeded' ||
                                !o.artist.stripeOnboardingComplete ||
                                !eligible
                              }
                            />
                          )
                        })()}
                    </div>
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
