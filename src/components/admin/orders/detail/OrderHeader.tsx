'use client'

import { CopyButton } from '@/components/admin/ui/CopyField'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import type { Bucket } from '@/lib/orders/orderBuckets'
import { formatOrderRef } from '@/lib/orders/orderRef'
import { REORDER_REASON_LABELS } from '@/lib/orders/reorderReasons'
import { formatEuro } from '@/lib/print-providers/format'

import type { AdminOrderDetail as Detail } from '@/app/admin/orders/actions'

import { BUCKET_LABELS, formatDateTime } from './orderDetailModel'

import styles from './OrderDetail.module.scss'

type OrderHeaderProps = {
  order: Detail
  bucket: Bucket
}

/** Thumbnail, "Order {ref}", the stage pill, one meta line, Copy reference (orders.md §2). */
export function OrderHeader({ order, bucket }: OrderHeaderProps) {
  const ref = formatOrderRef(order.id)
  // Legacy single-print orders are one print by definition.
  const prints = order.isCart ? order.items.length : 1
  const tone =
    bucket === 'attention'
      ? 'red'
      : bucket === 'cancelled' || bucket === 'refunded'
        ? 'outline'
        : 'dark'

  return (
    <header className={styles.header}>
      {order.thumbnailUrl && (
        <img src={order.thumbnailUrl} alt={order.artwork.title ?? ''} className={styles.thumb} />
      )}
      <div className={styles.headerText}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            Order <span className={styles.titleRef}>{ref}</span>
          </h1>
          <StatusPill label={BUCKET_LABELS[bucket]} tone={tone} />
        </div>
        <p className={styles.headerMeta}>
          Placed {formatDateTime(order.createdAt)} · {prints} {prints === 1 ? 'print' : 'prints'} ·{' '}
          <strong>{formatEuro(order.totalCents)}</strong>
          {order.buyerName ? ` · ${order.buyerName}` : ''}
        </p>
        {order.reorderCount > 0 && (
          <p className={styles.headerMeta}>
            <span className={styles.replacement}>
              Replacement{order.reorderCount > 1 ? ` ×${order.reorderCount}` : ''}
            </span>
            {order.reorderReason && (
              <span>
                {' '}
                —{' '}
                {REORDER_REASON_LABELS[order.reorderReason as keyof typeof REORDER_REASON_LABELS] ??
                  order.reorderReason}
              </span>
            )}
            {order.reorderNote && <span> · “{order.reorderNote}”</span>}
            {order.reorderedAt && <span> · {formatDateTime(order.reorderedAt)}</span>}
          </p>
        )}
      </div>
      <div className={styles.headerActions}>
        <CopyButton value={ref} label="Copy reference" />
      </div>
    </header>
  )
}
