import type { AdminOrderDetail as Detail } from '@/app/admin/orders/actions'
import type { ProgressStep } from '@/components/admin/ui/ProgressSteps'
import type { Bucket } from '@/lib/orders/orderBuckets'

export const formatDateTime = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Day, month and time for the narrow progress columns ("22 Aug, 23:04"). */
const formatStepDate = (iso: string | null) => {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** The buyer's address, read from either stored shape (see AdminOrderDetail). */
export type ShippingAddress = {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  phone?: string
}

/** Stage names, as on the Orders tabs (orders.md §1). */
export const BUCKET_LABELS: Record<Bucket, string> = {
  new: 'New',
  'to-place': 'To place at TPS',
  'at-tps': 'At TPS',
  production: 'In production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  done: 'Artist paid',
  cancelled: 'Canceled',
  refunded: 'Refunded',
  attention: 'Needs attention',
}

// Timeline dot per event kind: red for failures, dark for the milestones that
// move money or reach the buyer, mid gray for admin actions, light otherwise.
export type EventDot = 'red' | 'dark' | 'mid' | 'light'

export const eventDot = (kind: string): EventDot => {
  if (kind.endsWith('_failed') || kind === 'auth_canceled') return 'red'
  if (
    kind === 'captured' ||
    kind === 'auth_received' ||
    kind === 'email_sent' ||
    kind === 'payout_released'
  )
    return 'dark'
  if (kind === 'admin_action') return 'mid'
  return 'light'
}

const STEP_LABELS = [
  'New',
  'To place at TPS',
  'At TPS',
  'In production',
  'Shipped',
  'Delivered',
  'Artist paid',
]

/**
 * The seven-step trail at the top of the page (orders.md §2), from the same
 * fields the old badge trail read. The first steps follow `fulfillmentStatus`;
 * "Artist paid" follows `payoutComplete` (every line paid for carts, header
 * `paidOutAt` for legacy orders; a reversed line does not count).
 *
 * Dates only where one is stored (Q11): New = created, To place = the
 * `captured` event, Delivered = `shippedAt`, Artist paid = `payoutAt` (the
 * latest line for carts). A canceled order shows New, To place if it was
 * captured, then the red "Canceled" marker: once canceled, how far it got is
 * not stored.
 */
export function buildProgress(
  order: Detail,
  bucket: Bucket,
): { steps: ProgressStep[]; end?: string } {
  const fIdx = ['Placed', 'Started', 'Shipped', 'Complete'].indexOf(order.fulfillmentStatus ?? '')
  const captured = order.events.find((e) => e.kind === 'captured') ?? null
  const wasCaptured = captured !== null || order.paymentStatus === 'succeeded'
  const when = [
    order.createdAt,
    captured?.at ?? null,
    null,
    null,
    null,
    order.shippedAt,
    order.payoutAt,
  ]

  if (bucket === 'cancelled') {
    const steps: ProgressStep[] = [
      { label: STEP_LABELS[0], state: 'done', when: formatStepDate(when[0]) },
    ]
    if (wasCaptured) {
      steps.push({ label: STEP_LABELS[1], state: 'done', when: formatStepDate(when[1]) })
    }
    return { steps, end: 'Canceled' }
  }

  const reached = [
    true,
    fIdx >= 0 || wasCaptured,
    fIdx >= 0,
    fIdx >= 1,
    fIdx >= 2,
    fIdx >= 3,
    order.payoutComplete,
  ]
  let last = 0
  reached.forEach((r, i) => {
    if (r) last = i
  })
  // Only a live order has a "current" step; a refunded or failed one just shows
  // how far it got. A finished order (artist paid) is done all the way.
  const live = bucket !== 'refunded' && bucket !== 'attention'
  const current = live && last < STEP_LABELS.length - 1 ? last : null

  return {
    steps: STEP_LABELS.map((label, i) => {
      const state: ProgressStep['state'] = i === current ? 'current' : i <= last ? 'done' : 'future'
      return { label, state, when: state === 'future' ? null : formatStepDate(when[i]) }
    }),
  }
}
