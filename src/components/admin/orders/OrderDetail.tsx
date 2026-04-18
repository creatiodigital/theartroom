'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { formatEuro } from '@/components/PrintWizard/options'

import {
  getOrderDetail,
  refundOrder,
  type AdminOrderDetail as Detail,
} from '@/app/admin/orders/actions'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'

const formatDateTime = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const DOT_COLORS = {
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  blue: '#3b82f6',
  grey: '#9ca3af',
} as const
type DotColor = keyof typeof DOT_COLORS

const Dot = ({ color }: { color: DotColor }) => (
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

const paymentDot = (status: string): DotColor => {
  if (status === 'succeeded') return 'green'
  if (status === 'authorized') return 'blue'
  if (status === 'processing') return 'amber'
  if (status === 'failed') return 'red'
  return 'grey'
}

const prodigiDot = (stage: string | null): DotColor => {
  if (stage === 'Complete') return 'green'
  if (stage === 'Cancelled') return 'red'
  if (stage === 'InProgress') return 'amber'
  return 'grey'
}

// Pick a color for an event kind so the timeline is scannable.
const eventDot = (kind: string): DotColor => {
  if (kind.endsWith('_failed') || kind === 'prodigi_cancelled' || kind === 'auth_canceled')
    return 'red'
  if (kind === 'captured' || kind === 'auth_received' || kind === 'email_sent') return 'green'
  if (kind === 'prodigi_issue') return 'amber'
  if (kind.startsWith('prodigi_')) return 'blue'
  return 'grey'
}

type Section = { title: string; rows: Array<[string, React.ReactNode]> }

export const AdminOrderDetail = ({ orderId }: { orderId: string }) => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [order, setOrder] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [refundOpen, setRefundOpen] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refunding, setRefunding] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false)

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const t = session?.user?.userType
      if (t !== 'admin' && t !== 'superAdmin') router.push('/')
    }
  }, [sessionStatus, session, router])

  const load = useCallback(async () => {
    setError(null)
    const res = await getOrderDetail(orderId)
    if (res.ok) setOrder(res.order)
    else setError(res.error)
    setLoading(false)
  }, [orderId])

  useEffect(() => {
    if (sessionStatus === 'authenticated') load()
  }, [sessionStatus, load])

  const handleRefund = useCallback(async () => {
    if (!order) return
    setRefunding(true)
    setRefundError(null)
    const res = await refundOrder(order.id, { reason: refundReason })
    if (!res.ok) {
      setRefundError(res.error)
      setRefunding(false)
      setRefundConfirmOpen(false)
      return
    }
    setRefundOpen(false)
    setRefundReason('')
    setRefunding(false)
    setRefundConfirmOpen(false)
    await load()
  }, [order, refundReason, load])

  if (loading) {
    return (
      <DashboardLayout backLink="/admin/orders" backLabel="← Back to Orders">
        <p className={dashboardStyles.sectionDescription}>Loading…</p>
      </DashboardLayout>
    )
  }

  if (error || !order) {
    return (
      <DashboardLayout backLink="/admin/orders" backLabel="← Back to Orders">
        <p className={dashboardStyles.sectionDescription}>⚠️ {error ?? 'Order not found.'}</p>
      </DashboardLayout>
    )
  }

  const addr =
    (order.shippingAddress as {
      line1?: string
      line2?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
      phone?: string
    }) ?? {}
  const config =
    (order.printConfig as {
      paperId?: string
      formatId?: string
      sizeId?: string
      frameColorId?: string
      mountId?: string
      orientation?: string
    }) ?? {}

  const sections: Section[] = [
    {
      title: 'Buyer',
      rows: [
        ['Name', order.buyerName || '—'],
        ['Email', order.buyerEmail || '—'],
        ['Country', order.country],
        [
          'Shipping',
          <div key="ship" style={{ lineHeight: 1.5 }}>
            {addr.line1}
            {addr.line2 ? `, ${addr.line2}` : ''}
            <br />
            {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
            <br />
            {addr.country}
            {addr.phone ? (
              <>
                <br />
                {addr.phone}
              </>
            ) : null}
          </div>,
        ],
      ],
    },
    {
      title: 'Artwork & Config',
      rows: [
        [
          'Artwork',
          <>
            {order.artwork.title ?? order.artwork.slug ?? order.artwork.id}
            {' · '}
            <span style={{ opacity: 0.7 }}>{order.artist.name}</span>
          </>,
        ],
        ['Paper', config.paperId ?? '—'],
        ['Format', config.formatId ?? '—'],
        ['Size', config.sizeId ?? '—'],
        ['Frame color', config.frameColorId ?? '—'],
        ['Mount', config.mountId ?? '—'],
        ['Orientation', config.orientation ?? '—'],
      ],
    },
    {
      title: 'Totals',
      rows: [
        ['Total paid by buyer', formatEuro(order.totalCents)],
        ['Artist cut', formatEuro(order.artistCents)],
        ['Gallery cut', formatEuro(order.galleryCents)],
        ['Prodigi item', formatEuro(order.prodigiItemCents)],
        ['Prodigi shipping', formatEuro(order.prodigiShippingCents)],
        ['Customer VAT', formatEuro(order.customerVatCents)],
        ['Currency', order.currency.toUpperCase()],
      ],
    },
    {
      title: 'State',
      rows: [
        [
          'Payment',
          <span key="p">
            <Dot color={paymentDot(order.paymentStatus)} />
            <Badge label={order.paymentStatus} variant="current" />
          </span>,
        ],
        [
          'Prodigi',
          <span key="pr">
            <Dot color={prodigiDot(order.prodigiStage)} />
            <Badge label={order.prodigiStage ?? 'pending'} variant="current" />
          </span>,
        ],
        [
          'Prodigi order ID',
          order.prodigiOrderId ? (
            <a
              href={`https://dashboard.prodigi.com/orders/${order.prodigiOrderId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {order.prodigiOrderId}
            </a>
          ) : (
            '—'
          ),
        ],
        [
          'Stripe PaymentIntent',
          <a
            key="pi"
            href={`https://dashboard.stripe.com/payments/${order.paymentIntentId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {order.paymentIntentId}
          </a>,
        ],
        [
          'Tracking',
          order.trackingUrl ? (
            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
              {order.trackingUrl}
            </a>
          ) : (
            '—'
          ),
        ],
        ['Shipped at', formatDateTime(order.shippedAt)],
        [
          'Payout eligible',
          order.transferId
            ? 'Paid'
            : order.payoutEligibleAt
              ? (() => {
                  const at = new Date(order.payoutEligibleAt)
                  const ready = at.getTime() <= Date.now()
                  return ready ? (
                    <span>
                      <Dot color="amber" /> Ready ({formatDateTime(order.payoutEligibleAt)})
                    </span>
                  ) : (
                    <span>
                      <Dot color="blue" /> Holding until {formatDateTime(order.payoutEligibleAt)}
                    </span>
                  )
                })()
              : '—',
        ],
        ['Artist payout', order.transferId ? `Paid (${order.transferId})` : 'Not yet'],
      ],
    },
  ]

  return (
    <DashboardLayout backLink="/admin/orders" backLabel="← Back to Orders">
      <h1 className={dashboardStyles.pageTitle}>Order #{order.id.slice(0, 8)}</h1>
      <p className={dashboardStyles.sectionDescription}>
        Placed {formatDateTime(order.createdAt)} ·{' '}
        <Link href="/admin/orders">back to all orders</Link>
      </p>

      {(() => {
        const refundable =
          order.paymentStatus === 'authorized' || order.paymentStatus === 'succeeded'
        const alreadyRefunded = order.paymentStatus === 'refunded'
        return (
          <div className={dashboardStyles.section}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {!refundOpen && refundable && (
                <Button
                  font="dashboard"
                  variant="secondary"
                  label={`Refund buyer (${formatEuro(order.totalCents)})`}
                  onClick={() => setRefundOpen(true)}
                />
              )}
              {alreadyRefunded && <Badge label="Refunded" variant="unpublished" />}
              {!refundable && !alreadyRefunded && (
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>
                  Not refundable in current state ({order.paymentStatus}).
                </span>
              )}
            </div>

            {refundOpen && (
              <div
                style={{
                  marginTop: 12,
                  padding: 16,
                  border: '1px solid rgba(0,0,0,0.15)',
                  borderRadius: 4,
                  background: '#fafafa',
                }}
              >
                <p style={{ margin: '0 0 12px 0', fontSize: 14 }}>
                  <strong>Refund {formatEuro(order.totalCents)} to the buyer</strong>
                  {order.paymentStatus === 'authorized'
                    ? ' — no money has been charged yet; this releases the hold on their card.'
                    : ' — this returns the money from our Stripe balance to the buyer’s card. Takes 5–10 business days to appear on their statement.'}
                </p>

                {order.transferId && (
                  <p
                    style={{
                      margin: '0 0 12px 0',
                      padding: 10,
                      background: '#fff4cc',
                      border: '1px solid #e9c46a',
                      borderRadius: 4,
                      fontSize: 13,
                    }}
                  >
                    ⚠️ <strong>Artist payout already released</strong> (
                    {formatEuro(order.artistCents)}). Refunding here will <em>not</em> claw that
                    back — you&apos;ll need to recover it from the artist separately.
                  </p>
                )}

                <label
                  htmlFor="refund-reason"
                  style={{
                    display: 'block',
                    fontSize: 12,
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    opacity: 0.7,
                  }}
                >
                  Reason (internal, for audit log)
                </label>
                <textarea
                  id="refund-reason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid rgba(0,0,0,0.2)',
                    borderRadius: 4,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. Buyer reported damaged frame, photos provided."
                />

                {refundError && (
                  <p style={{ margin: '12px 0 0 0', color: '#b91c1c', fontSize: 13 }}>
                    ⚠️ {refundError}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <Button
                    font="dashboard"
                    variant="danger"
                    label="Issue refund"
                    onClick={() => setRefundConfirmOpen(true)}
                    disabled={refunding || refundReason.trim().length === 0}
                  />
                  <Button
                    font="dashboard"
                    variant="secondary"
                    label="Cancel"
                    onClick={() => {
                      setRefundOpen(false)
                      setRefundReason('')
                      setRefundError(null)
                    }}
                    disabled={refunding}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {sections.map((s) => (
        <div key={s.title} className={dashboardStyles.section}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: 16 }}>{s.title}</h2>
          <table className={dashboardStyles.table}>
            <tbody>
              {s.rows.map(([k, v], i) => (
                <tr key={i}>
                  <td style={{ width: 220, opacity: 0.7, verticalAlign: 'top' }}>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {refundConfirmOpen && (
        <ConfirmModal
          title="Refund the buyer?"
          message={
            <>
              This will refund <strong>{formatEuro(order.totalCents)}</strong> to{' '}
              <strong>{order.buyerName || order.buyerEmail}</strong> for order{' '}
              <code>#{order.id.slice(0, 8)}</code>.
              <br />
              <br />
              {order.paymentStatus === 'authorized'
                ? 'No money has been charged yet — this releases the hold on their card.'
                : 'The money will be returned from your Stripe balance to the buyer’s card. Stripe fees from the original charge are not refunded.'}
            </>
          }
          warning={
            order.transferId ? (
              <>
                <strong>Artist payout already released</strong> ({formatEuro(order.artistCents)}).
                This refund will not claw that back — you&apos;ll need to recover it from the artist
                separately.
              </>
            ) : null
          }
          confirmLabel="Yes, refund buyer"
          cancelLabel="Go back"
          destructive
          busy={refunding}
          onConfirm={handleRefund}
          onCancel={() => setRefundConfirmOpen(false)}
        />
      )}

      <div className={dashboardStyles.section}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Event timeline</h2>
        {order.events.length === 0 ? (
          <p className={dashboardStyles.sectionDescription}>No events recorded yet.</p>
        ) : (
          <table className={dashboardStyles.table}>
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th>When</th>
                <th>Kind</th>
                <th>Actor</th>
                <th>Message</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {order.events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Dot color={eventDot(e.kind)} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.at)}</td>
                  <td>
                    <code style={{ fontSize: 'var(--text-xs)' }}>{e.kind}</code>
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>{e.actor}</td>
                  <td>{e.message ?? '—'}</td>
                  <td>
                    {e.payload ? (
                      <details>
                        <summary style={{ cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
                          view
                        </summary>
                        <pre
                          style={{
                            fontSize: 11,
                            background: '#f8f8f8',
                            padding: 8,
                            overflow: 'auto',
                            maxWidth: 480,
                          }}
                        >
                          {JSON.stringify(e.payload, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      '—'
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
