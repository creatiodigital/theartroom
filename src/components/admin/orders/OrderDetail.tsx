'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { formatEuro, resolveSku } from '@/components/PrintWizard/options'
import type { PrintConfig } from '@/components/PrintWizard/types'

import {
  deleteOrder,
  getOrderDetail,
  markPlacedInProdigi,
  markRejected,
  refundOrder,
  syncOrderFromProdigi,
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
  if (stage === 'Rejected' || stage === 'Cancelled') return 'red'
  if (stage === 'Shipped') return 'blue'
  if (stage === 'Started' || stage === 'InProgress') return 'amber'
  if (stage === 'Placed') return 'amber'
  return 'grey'
}

const prodigiStageLabel = (stage: string | null): string => {
  if (!stage) return 'Pending placement'
  if (stage === 'Placed') return 'Placed in Prodigi'
  if (stage === 'Started') return 'In production'
  if (stage === 'Shipped') return 'Shipped'
  if (stage === 'Complete') return 'Complete'
  if (stage === 'Rejected') return 'Rejected'
  return stage
}

const TERMINAL_STAGES = new Set(['Complete', 'Rejected', 'Cancelled'])

const CopyButton = ({ value, label }: { value: string; label?: string }) => {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      style={{
        fontSize: 11,
        padding: '2px 8px',
        border: '1px solid rgba(0,0,0,0.2)',
        background: copied ? '#d1fae5' : '#fff',
        borderRadius: 3,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {copied ? 'Copied' : (label ?? 'Copy')}
    </button>
  )
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

  const [placeOpen, setPlaceOpen] = useState(false)
  const [prodigiOrderIdInput, setProdigiOrderIdInput] = useState('')
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)

  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const autoSyncedRef = useRef(false)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  const handleSync = useCallback(
    async (silent = false) => {
      if (!order?.prodigiOrderId) return
      if (order.prodigiStage && TERMINAL_STAGES.has(order.prodigiStage)) return
      setSyncing(true)
      if (!silent) setSyncMessage('Syncing with Prodigi…')
      const res = await syncOrderFromProdigi(order.id)
      setSyncing(false)
      if (res.ok) {
        setSyncMessage(
          res.changed
            ? `Updated — stage is now ${prodigiStageLabel(res.stage)}.`
            : silent
              ? null
              : 'No changes from Prodigi.',
        )
        if (res.changed) await load()
      } else {
        setSyncMessage(`⚠️ ${res.error}`)
      }
    },
    [order, load],
  )

  // Auto-sync once per page load, after the order is first loaded. If
  // there's a live Prodigi order ID and we're not terminal, pull the
  // latest status so what admin sees is fresh.
  useEffect(() => {
    if (!order) return
    if (autoSyncedRef.current) return
    if (!order.prodigiOrderId) return
    if (order.prodigiStage && TERMINAL_STAGES.has(order.prodigiStage)) return
    autoSyncedRef.current = true
    void handleSync(true)
  }, [order, handleSync])

  const handleMarkPlaced = useCallback(async () => {
    if (!order) return
    setPlacing(true)
    setPlaceError(null)
    const res = await markPlacedInProdigi(order.id, prodigiOrderIdInput)
    setPlacing(false)
    if (!res.ok) {
      setPlaceError(res.error)
      return
    }
    setPlaceOpen(false)
    setProdigiOrderIdInput('')
    await load()
  }, [order, prodigiOrderIdInput, load])

  const handleMarkRejected = useCallback(async () => {
    if (!order) return
    setRejecting(true)
    setRejectError(null)
    const res = await markRejected(order.id, rejectReason)
    setRejecting(false)
    if (!res.ok) {
      setRejectError(res.error)
      return
    }
    setRejectOpen(false)
    setRejectReason('')
    await load()
    if (res.needsRefund) {
      setRefundOpen(true)
    }
  }, [order, rejectReason, load])

  const handleDelete = useCallback(async () => {
    if (!order) return
    setDeleting(true)
    setDeleteError(null)
    const res = await deleteOrder(order.id)
    setDeleting(false)
    if (!res.ok) {
      setDeleteError(res.error)
      setDeleteConfirmOpen(false)
      return
    }
    router.push('/admin/orders')
  }, [order, router])

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
          'Fulfillment',
          <span key="pr">
            <Dot color={prodigiDot(order.prodigiStage)} />
            <Badge label={prodigiStageLabel(order.prodigiStage)} variant="current" />
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

  const stage = order.prodigiStage
  const isTerminal = stage ? TERMINAL_STAGES.has(stage) : false
  const canMarkPlaced = stage === null && order.paymentStatus === 'authorized'
  const canSync = !!order.prodigiOrderId && !isTerminal
  const canReject = stage !== null && !isTerminal

  // Pick up the latest Prodigi sync event and check for issues / Error
  // states in the per-phase details. Surfaces blockers that would
  // otherwise sit buried in the event log payload.
  const latestSync = order.events.find((e) => e.kind === 'prodigi_status_changed')
  const latestSyncPayload =
    latestSync?.payload && typeof latestSync.payload === 'object'
      ? (latestSync.payload as {
          issues?: Array<{ errorCode: string; description: string }>
          details?: Record<string, string>
        })
      : null
  const issues = latestSyncPayload?.issues ?? []
  const erroredPhases = Object.entries(latestSyncPayload?.details ?? {}).filter(
    ([, v]) => v === 'Error',
  )

  return (
    <DashboardLayout backLink="/admin/orders" backLabel="← Back to Orders">
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 8 }}>
        {order.thumbnailUrl && (
          <img
            src={order.thumbnailUrl}
            alt={order.artwork.title ?? ''}
            style={{
              width: 96,
              height: 96,
              objectFit: 'contain',
              borderRadius: 4,
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className={dashboardStyles.pageTitle} style={{ margin: 0 }}>
            Order #{order.id.slice(0, 8)}
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 14 }}>
            <strong>{order.artwork.title ?? '(untitled)'}</strong>
            <span style={{ opacity: 0.6 }}> — {order.artist.name}</span>
          </p>
          <p className={dashboardStyles.sectionDescription} style={{ margin: '4px 0 0 0' }}>
            Placed {formatDateTime(order.createdAt)} ·{' '}
            <Link href="/admin/orders">back to all orders</Link>
          </p>
        </div>
      </div>

      {order.prodigiStage === 'Rejected' && order.paymentStatus === 'succeeded' && (
        <div className={dashboardStyles.section}>
          <div
            style={{
              padding: '12px 16px',
              background: '#fdecea',
              border: '1px solid #f5a5a0',
              borderRadius: 4,
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>💸 Refund needed</p>
            <p style={{ margin: '0 0 8px 0' }}>
              This order is cancelled but the buyer&apos;s card was already charged{' '}
              <strong>{formatEuro(order.totalCents)}</strong>. Use the <strong>Refund buyer</strong>{' '}
              button below to return the money.
            </p>
          </div>
        </div>
      )}

      {(issues.length > 0 || erroredPhases.length > 0) && (
        <div className={dashboardStyles.section}>
          <div
            style={{
              padding: '12px 16px',
              background: '#fdecea',
              border: '1px solid #f5a5a0',
              borderRadius: 4,
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>
              ⚠️ Prodigi reported an issue on this order
            </p>
            {erroredPhases.length > 0 && (
              <p style={{ margin: '0 0 8px 0' }}>
                Phases in <code>Error</code> state:{' '}
                {erroredPhases.map(([k], i) => (
                  <span key={k}>
                    {i > 0 ? ', ' : ''}
                    <code>{k}</code>
                  </span>
                ))}
                . Common cause: <code>downloadAssets</code> = Error means Prodigi couldn&apos;t
                fetch the asset URL (check that the R2 URL is still reachable).
              </p>
            )}
            {issues.length > 0 && (
              <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
                {issues.map((i) => (
                  <li key={`${i.errorCode}:${i.description}`}>
                    <strong>{i.errorCode}</strong> — {i.description}
                  </li>
                ))}
              </ul>
            )}
            <p style={{ margin: '8px 0 0 0', fontSize: 12, opacity: 0.75 }}>
              Click &ldquo;Refresh from Prodigi&rdquo; below after you&apos;ve fixed it on their
              side, or &ldquo;Mark rejected&rdquo; to cancel the order.
            </p>
          </div>
        </div>
      )}

      <div className={dashboardStyles.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Fulfillment</h2>
          <Dot color={prodigiDot(stage)} />
          <Badge label={prodigiStageLabel(stage)} variant="current" />
          {syncing && <span style={{ fontSize: 12, opacity: 0.6 }}>Syncing with Prodigi…</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canMarkPlaced && (
            <Button
              font="dashboard"
              variant="primary"
              label="Mark placed in Prodigi"
              onClick={() => {
                setPlaceError(null)
                setPlaceOpen(true)
              }}
            />
          )}
          {canSync && (
            <Button
              font="dashboard"
              variant="secondary"
              label={syncing ? 'Refreshing…' : 'Refresh from Prodigi'}
              onClick={() => handleSync(false)}
              disabled={syncing}
            />
          )}
          {canReject && (
            <Button
              font="dashboard"
              variant="secondary"
              label="Mark rejected"
              onClick={() => {
                setRejectError(null)
                setRejectOpen(true)
              }}
            />
          )}
          {stage === null && order.paymentStatus !== 'authorized' && (
            <span style={{ fontSize: 12, opacity: 0.6 }}>
              Waiting for payment to authorize before you can place in Prodigi.
            </span>
          )}
          {isTerminal && (
            <span style={{ fontSize: 12, opacity: 0.6 }}>
              Terminal stage — no further fulfillment action.
            </span>
          )}
        </div>

        {syncMessage && (
          <p style={{ margin: '12px 0 0 0', fontSize: 13, opacity: 0.8 }}>{syncMessage}</p>
        )}
      </div>

      {(() => {
        let sku: string | null = null
        let skuAttributes: Record<string, string> = {}
        try {
          const resolved = resolveSku(order.printConfig as PrintConfig)
          sku = resolved.sku
          skuAttributes = resolved.attributes
        } catch {
          // Config doesn't map to a known SKU — show nothing rather than crash.
        }
        return (
          <div className={dashboardStyles.section}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: 16 }}>For Prodigi placement</h2>
            <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 16px 0' }}>
              Paste these into Prodigi&rsquo;s order form.
            </p>

            {sku ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      opacity: 0.6,
                      marginBottom: 4,
                    }}
                  >
                    SKU
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <code
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 14,
                        background: '#f6f6f6',
                        padding: '6px 10px',
                        borderRadius: 3,
                      }}
                    >
                      {sku}
                    </code>
                    <CopyButton value={sku} label="Copy SKU" />
                  </div>
                </div>

                {Object.keys(skuAttributes).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        opacity: 0.6,
                        marginBottom: 4,
                      }}
                    >
                      Attributes
                    </div>
                    <table style={{ fontSize: 13 }}>
                      <tbody>
                        {Object.entries(skuAttributes).map(([k, v]) => (
                          <tr key={k}>
                            <td style={{ padding: '2px 16px 2px 0', opacity: 0.7 }}>{k}</td>
                            <td style={{ padding: '2px 0', fontFamily: 'monospace' }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
                Could not resolve SKU from this order&rsquo;s config. Check the admin notification
                email for the exact SKU.
              </p>
            )}

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  opacity: 0.6,
                  marginBottom: 4,
                }}
              >
                Shipping method
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 13,
                    background: '#f6f6f6',
                    padding: '4px 8px',
                    borderRadius: 3,
                  }}
                >
                  Standard
                </code>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  opacity: 0.6,
                  marginBottom: 4,
                }}
              >
                Recipient
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  {order.buyerName}
                  <br />
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
                </div>
                <CopyButton
                  value={[
                    order.buyerName,
                    [addr.line1, addr.line2].filter(Boolean).join(', '),
                    [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', '),
                    addr.country,
                    addr.phone,
                  ]
                    .filter(Boolean)
                    .join('\n')}
                  label="Copy address"
                />
              </div>
            </div>
            {order.assetUrl && (
              <div style={{ marginBottom: 4 }}>
                <div
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    opacity: 0.6,
                    marginBottom: 4,
                  }}
                >
                  Print asset URL
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <code
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      background: '#f6f6f6',
                      padding: '4px 8px',
                      borderRadius: 3,
                      wordBreak: 'break-all',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {order.assetUrl}
                  </code>
                  <CopyButton value={order.assetUrl} label="Copy URL" />
                  <a
                    href={order.assetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12 }}
                  >
                    Open
                  </a>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {placeOpen && (
        <div className={dashboardStyles.section}>
          <div
            style={{
              padding: 16,
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: 4,
              background: '#fafafa',
            }}
          >
            <p style={{ margin: '0 0 12px 0', fontSize: 14 }}>
              <strong>Mark this order as placed in Prodigi</strong> — enter the Prodigi order ID
              (from their dashboard). This will capture the buyer&apos;s Stripe payment (
              {formatEuro(order.totalCents)}) and link the two orders for status syncing.
            </p>
            <label
              htmlFor="prodigi-order-id"
              style={{
                display: 'block',
                fontSize: 12,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                opacity: 0.7,
              }}
            >
              Prodigi order ID
            </label>
            <input
              id="prodigi-order-id"
              value={prodigiOrderIdInput}
              onChange={(e) => setProdigiOrderIdInput(e.target.value)}
              placeholder="ord_xxxxxxxxxxxxxxxx"
              style={{
                width: '100%',
                padding: 8,
                border: '1px solid rgba(0,0,0,0.2)',
                borderRadius: 4,
                fontFamily: 'monospace',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
            />
            {placeError && (
              <p style={{ margin: '12px 0 0 0', color: '#b91c1c', fontSize: 13 }}>
                ⚠️ {placeError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button
                font="dashboard"
                variant="primary"
                label={placing ? 'Capturing…' : 'Capture payment & mark placed'}
                onClick={handleMarkPlaced}
                disabled={placing || prodigiOrderIdInput.trim().length === 0}
              />
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={() => {
                  setPlaceOpen(false)
                  setProdigiOrderIdInput('')
                  setPlaceError(null)
                }}
                disabled={placing}
              />
            </div>
          </div>
        </div>
      )}

      {rejectOpen && (
        <div className={dashboardStyles.section}>
          <div
            style={{
              padding: 16,
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: 4,
              background: '#fafafa',
            }}
          >
            <p style={{ margin: '0 0 12px 0', fontSize: 14 }}>
              <strong>Mark this order as rejected</strong>
              {order.paymentStatus === 'authorized'
                ? ' — the Stripe hold will be voided immediately (no money moves).'
                : order.paymentStatus === 'succeeded'
                  ? ' — the payment was already captured; after marking rejected you’ll need to issue a refund separately.'
                  : '.'}
            </p>
            {(order.prodigiStage === 'Started' || order.prodigiStage === 'Shipped') && (
              <p
                style={{
                  margin: '0 0 12px 0',
                  padding: 10,
                  background: '#fff4cc',
                  border: '1px solid #e9c46a',
                  borderRadius: 4,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                ⚠️ <strong>Prodigi has already started production.</strong> Per their cancellation
                policy, if you cancel this order on Prodigi&apos;s side now they will keep the
                production cost and only refund unused shipping. The buyer-side refund is separate
                (full amount) — you&apos;ll eat the difference.
              </p>
            )}
            <label
              htmlFor="reject-reason"
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
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Prodigi rejected the file for low resolution."
              style={{
                width: '100%',
                padding: 8,
                border: '1px solid rgba(0,0,0,0.2)',
                borderRadius: 4,
                fontFamily: 'inherit',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
            />
            {rejectError && (
              <p style={{ margin: '12px 0 0 0', color: '#b91c1c', fontSize: 13 }}>
                ⚠️ {rejectError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button
                font="dashboard"
                variant="danger"
                label={rejecting ? 'Marking…' : 'Mark rejected'}
                onClick={handleMarkRejected}
                disabled={rejecting || rejectReason.trim().length === 0}
              />
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={() => {
                  setRejectOpen(false)
                  setRejectReason('')
                  setRejectError(null)
                }}
                disabled={rejecting}
              />
            </div>
          </div>
        </div>
      )}

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

      <div className={dashboardStyles.section}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: 16 }}>Danger zone</h2>
        <p className={dashboardStyles.sectionDescription} style={{ margin: '0 0 16px 0' }}>
          Permanently delete this order and its event history. Only available while no money has
          been captured and the artist payout has not been released.
        </p>
        {deleteError && (
          <p style={{ margin: '0 0 12px 0', color: '#b91c1c', fontSize: 13 }}>⚠️ {deleteError}</p>
        )}
        <Button
          font="dashboard"
          variant="danger"
          label="Delete order"
          onClick={() => {
            setDeleteError(null)
            setDeleteConfirmOpen(true)
          }}
        />
      </div>

      {deleteConfirmOpen && (
        <ConfirmModal
          title="Delete this order?"
          message={
            <>
              This will <strong>permanently remove</strong> order{' '}
              <code>#{order.id.slice(0, 8)}</code> and its entire event history from the database.
              {order.paymentStatus === 'authorized' && (
                <>
                  <br />
                  <br />
                  The Stripe card hold ({formatEuro(order.totalCents)}) will be cancelled before the
                  order is removed, releasing the funds back to the buyer&apos;s card.
                </>
              )}
            </>
          }
          warning={
            <>
              This cannot be undone. If this is a real customer order, consider using{' '}
              <strong>Mark rejected</strong> or <strong>Refund buyer</strong> instead so you keep
              the audit trail.
            </>
          }
          confirmLabel="Yes, delete permanently"
          cancelLabel="Keep order"
          destructive
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}
    </DashboardLayout>
  )
}
