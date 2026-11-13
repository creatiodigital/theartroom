'use client'

import { Panel } from '@/components/admin/ui/Panel'
import { formatEuro } from '@/lib/print-providers/format'

import type { AdminOrderDetail as Detail } from '@/app/admin/orders/actions'

import { formatDateTime } from './orderDetailModel'

import styles from './OrderDetail.module.scss'

/** Where the buyer's money stands, under the total (Q15: a date only where one is stored). */
function paymentState(paymentStatus: string, capturedAt: string | null): string {
  switch (paymentStatus) {
    case 'authorized':
      return 'card on hold until captured'
    case 'succeeded':
      return capturedAt ? `captured ${formatDateTime(capturedAt)}` : 'captured'
    case 'refunded':
      return 'refunded'
    case 'canceled':
      return 'hold canceled, nothing charged'
    case 'failed':
      return 'payment failed, nothing charged'
    default:
      return paymentStatus
  }
}

/**
 * Side column: the total and how it splits (orders.md §2). On a cart order the
 * cuts live on each line (the header columns are deprecated rollups), so they
 * are summed from the lines; a legacy order's header is the source.
 */
export function MoneyPanel({ order }: { order: Detail }) {
  const sumLines = (pick: (it: Detail['items'][number]) => number) =>
    order.items.reduce((total, it) => total + pick(it), 0)
  const artistCents = order.isCart ? sumLines((it) => it.artistCents) : order.artistCents
  const galleryCents = order.isCart ? sumLines((it) => it.galleryCents) : order.galleryCents
  const productionCents = order.isCart
    ? sumLines((it) => it.productionCents)
    : order.productionCents
  const captured = order.events.find((e) => e.kind === 'captured') ?? null

  const rows: [string, number][] = [
    ['Artist cut', artistCents],
    ['Gallery cut', galleryCents],
    ['Production', productionCents],
    ['Production shipping', order.productionShippingCents],
    ['Customer VAT', order.customerVatCents],
  ]

  return (
    <Panel title="Money" className={styles.sidePanel}>
      <div className={styles.paid}>
        <span className={styles.paidLabel}>Paid by buyer</span>
        <span className={styles.paidAmount}>{formatEuro(order.totalCents)}</span>
        <span className={styles.paidState}>
          {order.currency.toUpperCase()} · {paymentState(order.paymentStatus, captured?.at ?? null)}
        </span>
      </div>
      <dl className={styles.moneyList}>
        {rows.map(([label, cents]) => (
          <div key={label} className={styles.moneyRow}>
            <dt>{label}</dt>
            <dd>{formatEuro(cents)}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}
