'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { AdminBreadcrumb } from '@/components/admin/ui/AdminBreadcrumb'
import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { Callout } from '@/components/admin/ui/Callout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AUTHORIZATION_LIFETIME_DAYS, authorizationHold } from '@/lib/orders/authorizationPolicy'
import { bucketOf } from '@/lib/orders/orderBuckets'
import { formatOrderRef } from '@/lib/orders/orderRef'
import { daysSinceDelivered, PAYOUT_SAFE_WINDOW_DAYS } from '@/lib/orders/payoutPolicy'
import { formatEuro } from '@/lib/print-providers/format'
import { countryName } from '@/utils/countryName'

import {
  deleteOrder,
  getOrderDetail,
  markDelivered,
  markPaidManually,
  capturePayment,
  markPlacedAtTps,
  cancelOrder,
  markShipped,
  markStarted,
  refundOrder,
  reorderForReprint,
  releasePayout,
  sendInvoice,
  issueCreditNote,
  type AdminOrderDetail as Detail,
} from '@/app/admin/orders/actions'

// Order hard-delete is a dev/staging cleanup tool only — in production the
// Test data panel does not render (and the server action refuses regardless).
import { DEV_CLEANUP_ALLOWED } from '@/lib/admin/devCleanup'

import { BuyerPanel } from './BuyerPanel'
import { InvoicePanel } from './InvoicePanel'
import { MoneyPanel } from './MoneyPanel'
import { OrderHeader } from './OrderHeader'
import { OrderItems } from './OrderItems'
import { OrderProgress } from './OrderProgress'
import { OrderTimeline } from './OrderTimeline'
import { OrderWarnings } from './OrderWarnings'
import { PayArtists } from './PayArtists'
import { RecoveryPanel } from './RecoveryPanel'
import { TestDataPanel } from './TestDataPanel'
import { TpsPlacement } from './TpsPlacement'
import { buildProgress, type ShippingAddress } from './orderDetailModel'

import styles from './OrderDetail.module.scss'

const TERMINAL_STAGES = new Set(['Complete', 'Cancelled'])

/**
 * /admin/orders/[id] (orders.md §2). This component owns every piece of state,
 * every handler and every guard; the sections in this folder only render what
 * they are given. After each action the order is re-read with load().
 */
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

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const [reorderOpen, setReorderOpen] = useState(false)
  const [reorderReason, setReorderReason] = useState('')
  const [reorderNote, setReorderNote] = useState('')
  const [reordering, setReordering] = useState(false)
  const [reorderError, setReorderError] = useState<string | null>(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [busy, setBusy] = useState<
    'capture' | 'placed' | 'started' | 'shipped' | 'delivered' | null
  >(null)
  const [busyError, setBusyError] = useState<string | null>(null)
  const [shipOpen, setShipOpen] = useState(false)
  const [trackingUrlInput, setTrackingUrlInput] = useState('')

  const [invoiceConfirmOpen, setInvoiceConfirmOpen] = useState(false)
  const [sendingInvoice, setSendingInvoice] = useState(false)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)

  const [creditNoteConfirmOpen, setCreditNoteConfirmOpen] = useState(false)
  const [creditNoteReason, setCreditNoteReason] = useState('')
  const [issuingCreditNote, setIssuingCreditNote] = useState(false)
  const [creditNoteError, setCreditNoteError] = useState<string | null>(null)

  const [payOpen, setPayOpen] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const [manualOpen, setManualOpen] = useState(false)
  const [manualMethod, setManualMethod] = useState('')
  const [manualReference, setManualReference] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  // The Refund-needed warning's button opens the refund panel in the side
  // column, which can be far down the page (on a phone it is after the
  // timeline), so it also brings the panel into view and focuses its reason.
  const refundPanelNode = useRef<HTMLDivElement | null>(null)
  const scrollToRefundPanel = useRef(false)
  const refundPanelRef = useCallback((node: HTMLDivElement | null) => {
    refundPanelNode.current = node
    if (node && scrollToRefundPanel.current) {
      scrollToRefundPanel.current = false
      bringIntoView(node)
    }
  }, [])

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

  const handleCancelOrder = useCallback(async () => {
    if (!order) return
    setCanceling(true)
    setCancelError(null)
    const res = await cancelOrder(order.id, cancelReason)
    setCanceling(false)
    if (!res.ok) {
      setCancelError(res.error)
      return
    }
    setCancelOpen(false)
    setCancelReason('')
    await load()
    if (res.needsRefund) setRefundOpen(true)
  }, [order, cancelReason, load])

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

  const handleCapture = useCallback(async () => {
    if (!order) return
    setBusy('capture')
    setBusyError(null)
    const res = await capturePayment(order.id)
    setBusy(null)
    if (!res.ok) {
      setBusyError(res.error)
      return
    }
    await load()
  }, [order, load])

  const handlePlacedAtTps = useCallback(async () => {
    if (!order) return
    setBusy('placed')
    setBusyError(null)
    const res = await markPlacedAtTps(order.id)
    setBusy(null)
    if (!res.ok) {
      setBusyError(res.error)
      return
    }
    await load()
  }, [order, load])

  const handleReorder = useCallback(async () => {
    if (!order) return
    setReordering(true)
    setReorderError(null)
    const res = await reorderForReprint(order.id, { reason: reorderReason, note: reorderNote })
    setReordering(false)
    if (!res.ok) {
      setReorderError(res.error)
      return
    }
    setReorderOpen(false)
    setReorderReason('')
    setReorderNote('')
    await load()
  }, [order, reorderReason, reorderNote, load])

  const handleStarted = useCallback(async () => {
    if (!order) return
    setBusy('started')
    setBusyError(null)
    const res = await markStarted(order.id)
    setBusy(null)
    if (!res.ok) {
      setBusyError(res.error)
      return
    }
    await load()
  }, [order, load])

  const handleShipped = useCallback(async () => {
    if (!order) return
    setBusy('shipped')
    setBusyError(null)
    const res = await markShipped(order.id, trackingUrlInput || null)
    setBusy(null)
    if (!res.ok) {
      setBusyError(res.error)
      return
    }
    setShipOpen(false)
    setTrackingUrlInput('')
    await load()
  }, [order, trackingUrlInput, load])

  const handleDelivered = useCallback(async () => {
    if (!order) return
    setBusy('delivered')
    setBusyError(null)
    const res = await markDelivered(order.id)
    setBusy(null)
    if (!res.ok) {
      setBusyError(res.error)
      return
    }
    await load()
  }, [order, load])

  const handlePayArtist = useCallback(async () => {
    if (!order) return
    setPaying(true)
    setPayError(null)
    const res = await releasePayout(order.id)
    setPaying(false)
    if (!res.ok) {
      setPayError(res.error)
      return
    }
    setPayOpen(false)
    await load()
  }, [order, load])

  const handleMarkPaidManually = useCallback(async () => {
    if (!order) return
    setManualSubmitting(true)
    setManualError(null)
    const res = await markPaidManually(order.id, {
      method: manualMethod,
      reference: manualReference,
      note: manualNote,
    })
    setManualSubmitting(false)
    if (!res.ok) {
      setManualError(res.error)
      return
    }
    setManualOpen(false)
    setManualMethod('')
    setManualReference('')
    setManualNote('')
    await load()
  }, [order, manualMethod, manualReference, manualNote, load])

  const handleSendInvoice = useCallback(async () => {
    if (!order) return
    setSendingInvoice(true)
    setInvoiceError(null)
    const res = await sendInvoice(order.id)
    setSendingInvoice(false)
    setInvoiceConfirmOpen(false)
    if (!res.ok) {
      setInvoiceError(res.error)
      // Reload even on failure: per the number-burn rule the invoice row may
      // already be committed (render/email failed after minting) — the UI
      // must flip to the "invoice exists / re-send" state, not keep offering
      // a first issue.
      await load()
      return
    }
    if (!res.emailed) {
      setInvoiceError(
        `Invoice ${res.number} was issued and archived, but the EMAIL FAILED — the buyer has NOT received it. Use "Send invoice again" to retry.`,
      )
    }
    await load()
  }, [order, load])

  const handleIssueCreditNote = useCallback(async () => {
    if (!order) return
    setIssuingCreditNote(true)
    setCreditNoteError(null)
    const res = await issueCreditNote(order.id, creditNoteReason || undefined)
    setIssuingCreditNote(false)
    setCreditNoteConfirmOpen(false)
    if (!res.ok) {
      setCreditNoteError(res.error)
      // Same number-burn rule as invoices — reload so a committed credit
      // note shows up even when render/email failed.
      await load()
      return
    }
    if (!res.emailed) {
      setCreditNoteError(
        `Credit note ${res.number} was issued and archived, but the EMAIL FAILED — the buyer has NOT received it. Use "Send credit note again" to retry.`,
      )
    }
    setCreditNoteReason('')
    await load()
  }, [order, creditNoteReason, load])

  const breadcrumb = (
    <AdminBreadcrumb
      items={[
        { label: 'Orders', href: '/admin/orders' },
        { label: formatOrderRef(orderId), mono: true },
      ]}
    />
  )

  if (loading) {
    return (
      <div className={styles.detail}>
        {breadcrumb}
        <p className={styles.status}>Loading…</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className={styles.detail}>
        {breadcrumb}
        <Callout tone="red">{error ?? 'Order not found.'}</Callout>
      </div>
    )
  }

  // Cart orders store the buyer's ShippingAddress verbatim (address1 /
  // address2 / stateOrRegion / countryCode); single-print orders store Stripe's
  // shape (line1 / line2 / state / country). Read BOTH so the street + country
  // never go blank regardless of which path created the order.
  const rawAddr = (order.shippingAddress as Record<string, unknown> | null) ?? {}
  const addr: ShippingAddress = {
    line1: (rawAddr.line1 ?? rawAddr.address1) as string | undefined,
    line2: (rawAddr.line2 ?? rawAddr.address2) as string | undefined,
    city: rawAddr.city as string | undefined,
    state: (rawAddr.state ?? rawAddr.stateOrRegion) as string | undefined,
    postalCode: rawAddr.postalCode as string | undefined,
    country: (rawAddr.country ?? rawAddr.countryCode) as string | undefined,
    phone: rawAddr.phone as string | undefined,
  }
  // What "Copy address" puts on the clipboard (one line per address line).
  const recipientCopy = [
    order.buyerName,
    [addr.line1, addr.line2].filter(Boolean).join(', '),
    [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', '),
    countryName(addr.country),
    addr.phone,
  ]
    .filter(Boolean)
    .join('\n')

  const stage = order.fulfillmentStatus
  const isTerminal = stage ? TERMINAL_STAGES.has(stage) : false
  const canCancel = !isTerminal
  // A refunded or canceled order is terminal & READ-ONLY: no fulfillment
  // actions at all (advancing one would, e.g., email an already-refunded buyer
  // "in production"). The "Delete order" escape hatch in the Test data panel is
  // exempt — it stays available in every state.
  const isTerminalPayment = order.paymentStatus === 'refunded' || order.paymentStatus === 'canceled'

  // Silent-failure states that need an explicit explanation. A `canceled`
  // order with no fulfillment stage was never a deliberate dashboard
  // cancel (that sets fulfillmentStatus='Cancelled') — it's an expired or
  // externally-canceled auth, i.e. a lost sale. `failed` is a declined card.
  const isAuthExpired = order.paymentStatus === 'canceled' && order.fulfillmentStatus === null
  const isPaymentFailed = order.paymentStatus === 'failed'

  // Proactive warning as the auth window closes (or has lapsed) on a
  // still-authorized, unplaced order — capture before the sale is lost. The
  // countdown itself comes from authorizationPolicy, which the orders list and
  // the reconcile cron's daily warning also read, so the three cannot drift
  // apart on either the lifetime or the day it starts warning.
  const hold = order.fulfillmentStatus === null ? authorizationHold(order) : null
  const authExpiresAt = hold
    ? new Date(new Date(order.createdAt).getTime() + AUTHORIZATION_LIFETIME_DAYS * 86_400_000)
    : null
  const authExpiringSoon = hold !== null && hold.status !== 'fresh'

  const refundNeeded =
    order.fulfillmentStatus === 'Cancelled' && order.paymentStatus === 'succeeded'
  const refundable = order.paymentStatus === 'authorized' || order.paymentStatus === 'succeeded'
  const alreadyRefunded = order.paymentStatus === 'refunded'

  // Re-order / replacement reprint — available once a print physically
  // exists (produced/shipped/delivered). Resets the order to "To place at
  // TPS" for a fresh copy WITHOUT re-charging; same edition number remade.
  // A sanctioned backward move, kept apart from the forward CTA.
  const canReorder =
    order.paymentStatus === 'succeeded' &&
    ['Started', 'Shipped', 'Complete'].includes(order.fulfillmentStatus ?? '')

  // Per-item payouts for cart orders surface once the order is delivered
  // (Complete); each line is paid independently (mixed-artist carts), so the
  // order can be "partly paid out". The header-level pay block is for legacy
  // single-print orders only (on a cart it would pay the wrong, rolled-up
  // amount to the first artist only), and hides once the artist is paid.
  const showCartPayouts = order.isCart && order.fulfillmentStatus === 'Complete'
  const showLegacyPayout =
    !order.isCart && order.fulfillmentStatus === 'Complete' && !order.paidOutAt

  const bucket = bucketOf(order)
  const progress = buildProgress(order, bucket)

  // ── Openers / closers for the inline panels (moved out of the JSX) ──
  const openShipPanel = () => {
    setBusyError(null)
    setTrackingUrlInput(order.trackingUrl ?? '')
    setShipOpen(true)
  }
  const closeShipPanel = () => {
    setShipOpen(false)
    setTrackingUrlInput('')
    setBusyError(null)
  }
  const openCancelPanel = () => {
    setCancelError(null)
    setCancelOpen(true)
  }
  const keepOrder = () => {
    setCancelOpen(false)
    setCancelReason('')
    setCancelError(null)
  }
  const closeRefundPanel = () => {
    setRefundOpen(false)
    setRefundReason('')
    setRefundError(null)
  }
  const openRefundFromWarning = () => {
    if (refundOpen && refundPanelNode.current) {
      bringIntoView(refundPanelNode.current)
      return
    }
    scrollToRefundPanel.current = true
    setRefundOpen(true)
  }
  const openReorderPanel = () => {
    setReorderError(null)
    setReorderOpen(true)
  }
  const closeReorderPanel = () => {
    setReorderOpen(false)
    setReorderReason('')
    setReorderNote('')
    setReorderError(null)
  }
  const openPayConfirm = () => {
    setPayError(null)
    setPayOpen(true)
  }
  const openManualPay = () => {
    setManualError(null)
    setManualOpen(true)
  }
  const closeManualPay = () => {
    setManualOpen(false)
    setManualMethod('')
    setManualReference('')
    setManualNote('')
    setManualError(null)
  }
  const openInvoiceConfirm = () => {
    setInvoiceError(null)
    setInvoiceConfirmOpen(true)
  }
  const openCreditNoteConfirm = () => {
    setCreditNoteError(null)
    setCreditNoteConfirmOpen(true)
  }
  const openDeleteConfirm = () => {
    setDeleteError(null)
    setDeleteConfirmOpen(true)
  }

  return (
    <div className={styles.detail}>
      {breadcrumb}

      <OrderHeader order={order} bucket={bucket} />

      <OrderWarnings
        order={order}
        isTerminalPayment={isTerminalPayment}
        isAuthExpired={isAuthExpired}
        isPaymentFailed={isPaymentFailed}
        authExpiresAt={authExpiringSoon ? authExpiresAt : null}
        refundNeeded={refundNeeded}
        onRefund={openRefundFromWarning}
      />

      <OrderProgress
        order={order}
        bucket={bucket}
        steps={progress.steps}
        end={progress.end}
        stage={stage}
        isTerminalPayment={isTerminalPayment}
        canCancel={canCancel}
        busy={busy}
        busyError={busyError}
        onCapture={handleCapture}
        onPlacedAtTps={handlePlacedAtTps}
        onStarted={handleStarted}
        onDelivered={handleDelivered}
        ship={{
          open: shipOpen,
          trackingUrl: trackingUrlInput,
          onTrackingUrlChange: setTrackingUrlInput,
          onOpen: openShipPanel,
          onSubmit: handleShipped,
          onClose: closeShipPanel,
        }}
        cancel={{
          open: cancelOpen,
          reason: cancelReason,
          onReasonChange: setCancelReason,
          canceling,
          error: cancelError,
          onOpen: openCancelPanel,
          onSubmit: handleCancelOrder,
          onKeep: keepOrder,
        }}
      />

      <div className={styles.columns}>
        <div className={styles.main}>
          <OrderItems order={order} />

          {(showCartPayouts || showLegacyPayout) && (
            <PayArtists
              order={order}
              mode={showCartPayouts ? 'cart' : 'legacy'}
              onItemPaid={load}
              legacy={{
                paying,
                payError,
                onPayWithStripe: openPayConfirm,
                manual: {
                  open: manualOpen,
                  method: manualMethod,
                  reference: manualReference,
                  note: manualNote,
                  onMethodChange: setManualMethod,
                  onReferenceChange: setManualReference,
                  onNoteChange: setManualNote,
                  submitting: manualSubmitting,
                  error: manualError,
                  onOpen: openManualPay,
                  onSubmit: handleMarkPaidManually,
                  onClose: closeManualPay,
                },
              }}
            />
          )}

          <TpsPlacement order={order} addr={addr} recipientCopy={recipientCopy} />

          <OrderTimeline events={order.events} />
        </div>

        <aside className={styles.side} aria-label="Order summary and actions">
          <BuyerPanel order={order} addr={addr} />
          <MoneyPanel order={order} />
          <InvoicePanel
            order={order}
            sendingInvoice={sendingInvoice}
            invoiceError={invoiceError}
            issuingCreditNote={issuingCreditNote}
            creditNoteError={creditNoteError}
            onSendInvoice={openInvoiceConfirm}
            onIssueCreditNote={openCreditNoteConfirm}
            onResendCreditNote={() => void handleIssueCreditNote()}
          />
          <RecoveryPanel
            order={order}
            reorder={{
              available: canReorder,
              open: reorderOpen,
              reason: reorderReason,
              note: reorderNote,
              onReasonChange: setReorderReason,
              onNoteChange: setReorderNote,
              reordering,
              error: reorderError,
              onOpen: openReorderPanel,
              onSubmit: handleReorder,
              onClose: closeReorderPanel,
            }}
            refund={{
              refundable,
              alreadyRefunded,
              open: refundOpen,
              reason: refundReason,
              onReasonChange: setRefundReason,
              refunding,
              error: refundError,
              panelRef: refundPanelRef,
              onOpen: () => setRefundOpen(true),
              onSubmit: () => setRefundConfirmOpen(true),
              onClose: closeRefundPanel,
            }}
          />
          {DEV_CLEANUP_ALLOWED && (
            <TestDataPanel error={deleteError} onDelete={openDeleteConfirm} />
          )}
        </aside>
      </div>

      {/* Confirmation modal for the actual transfer. Stays open on failure: the
          error shows in the pay block behind it. */}
      {payOpen && order && (
        <AdminConfirmModal
          title="Pay the artist?"
          message={
            <>
              This will transfer <strong>{formatEuro(order.artistCents)}</strong> to{' '}
              <strong>{order.artist.name}</strong>&apos;s Stripe account for order{' '}
              <code>{formatOrderRef(order.id)}</code>. The order will then move into the Done tab.
              <br />
              <br />
              Once released, the money is on the artist&apos;s side — you can&apos;t pull it back
              from this dashboard.
            </>
          }
          warning={(() => {
            const days = daysSinceDelivered(order.shippedAt)
            if (days === null || days >= PAYOUT_SAFE_WINDOW_DAYS) return null
            return (
              <>
                Delivered <strong>{days}</strong> day{days === 1 ? '' : 's'} ago — only{' '}
                {PAYOUT_SAFE_WINDOW_DAYS - days} day
                {PAYOUT_SAFE_WINDOW_DAYS - days === 1 ? '' : 's'} into the {PAYOUT_SAFE_WINDOW_DAYS}
                -day safe window. If the buyer disputes this order later, recovering the
                artist&apos;s share will be on you.
              </>
            )
          })()}
          confirmLabel="Yes, pay the artist"
          cancelLabel="Cancel"
          destructive
          busy={paying}
          onConfirm={handlePayArtist}
          onCancel={() => setPayOpen(false)}
        />
      )}

      {invoiceConfirmOpen && order && (
        <AdminConfirmModal
          title={order.invoice ? 'Re-send invoice?' : 'Issue and send invoice?'}
          message={
            order.invoice ? (
              <>
                This will re-email invoice <code>{order.invoice.number}</code> to{' '}
                <strong>{order.buyerEmail}</strong>. The same PDF and number are reused — no new
                invoice is created.
              </>
            ) : (
              <>
                This will issue an invoice for order <code>{formatOrderRef(order.id)}</code> and
                email it to <strong>{order.buyerEmail}</strong>. The invoice number is permanent —
                it cannot be voided from this screen.
              </>
            )
          }
          confirmLabel={order.invoice ? 'Yes, re-send' : 'Yes, send invoice'}
          cancelLabel="Cancel"
          busy={sendingInvoice}
          onConfirm={handleSendInvoice}
          onCancel={() => setInvoiceConfirmOpen(false)}
        />
      )}

      {creditNoteConfirmOpen && order && order.invoice && (
        <AdminConfirmModal
          title="Issue credit note?"
          message={
            <div className={styles.dialogForm}>
              <p>
                This will issue a credit note correcting invoice <code>{order.invoice.number}</code>{' '}
                and email it to <strong>{order.buyerEmail}</strong>.
              </p>
              <p className={styles.dialogNote}>
                This cannot be undone. Both documents (invoice + credit note) go to the accountant
                and net to zero.
              </p>
              <div className={styles.dialogField}>
                <label htmlFor="credit-note-reason" className={styles.dialogLabel}>
                  Reason (optional)
                </label>
                <div className={styles.presets}>
                  {['Refund', 'Issued in error'].map((preset) => (
                    <Button
                      key={preset}
                      variant="bare"
                      font="dashboard"
                      className={styles.preset}
                      label={preset}
                      onClick={() => setCreditNoteReason(preset)}
                    />
                  ))}
                </div>
                <Input
                  id="credit-note-reason"
                  type="text"
                  size="bare"
                  inputClassName={styles.dialogInput}
                  placeholder="e.g. Order canceled by buyer"
                  value={creditNoteReason}
                  onChange={(e) => setCreditNoteReason(e.target.value)}
                />
              </div>
            </div>
          }
          confirmLabel={issuingCreditNote ? 'Issuing…' : 'Yes, issue credit note'}
          cancelLabel="Cancel"
          busy={issuingCreditNote}
          onConfirm={handleIssueCreditNote}
          onCancel={() => {
            setCreditNoteConfirmOpen(false)
            setCreditNoteReason('')
          }}
        />
      )}

      {refundConfirmOpen && (
        <AdminConfirmModal
          title="Refund the buyer?"
          message={
            <>
              This will refund <strong>{formatEuro(order.totalCents)}</strong> to{' '}
              <strong>{order.buyerName || order.buyerEmail}</strong> for order{' '}
              <code>{formatOrderRef(order.id)}</code>.
              <br />
              <br />
              {order.paymentStatus === 'authorized'
                ? 'No money has been charged yet — this releases the hold on their card.'
                : 'The money will be returned from your Stripe balance to the buyer’s card. Stripe fees from the original charge are not refunded.'}
            </>
          }
          warning={
            order.paidOutAt ? (
              <>
                <strong>Artist payout already released</strong> ({formatEuro(order.artistCents)}
                {order.transferId ? ' via Stripe' : ' manually'}). This refund will not claw that
                back — you&apos;ll need to recover it from the artist separately.
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

      {deleteConfirmOpen && (
        <AdminConfirmModal
          title="Delete this order?"
          message={
            <>
              This will <strong>permanently remove</strong> order{' '}
              <code>{formatOrderRef(order.id)}</code> and its entire event history from the
              database.
              {order.paymentStatus === 'authorized' && (
                <>
                  <br />
                  <br />
                  The Stripe card hold ({formatEuro(order.totalCents)}) will be canceled
                  best-effort, releasing the funds back to the buyer&apos;s card.
                </>
              )}
            </>
          }
          warning="This cannot be undone."
          confirmLabel="Yes, delete permanently"
          cancelLabel="Keep order"
          destructive
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}
    </div>
  )
}

/** Scroll a panel to the middle of the screen and put the cursor in its first field. */
function bringIntoView(node: HTMLElement) {
  node.scrollIntoView({ behavior: 'smooth', block: 'center' })
  node.querySelector<HTMLElement>('textarea, input, select')?.focus({ preventScroll: true })
}
