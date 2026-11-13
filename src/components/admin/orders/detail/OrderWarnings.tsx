'use client'

import c from 'classnames'

import { Callout } from '@/components/admin/ui/Callout'
import { Button } from '@/components/ui/Button'
import { AUTHORIZATION_LIFETIME_DAYS } from '@/lib/orders/authorizationPolicy'
import { formatEuro } from '@/lib/print-providers/format'

import type { AdminOrderDetail as Detail } from '@/app/admin/orders/actions'

import { formatDateTime } from './orderDetailModel'

import styles from './OrderDetail.module.scss'

type OrderWarningsProps = {
  order: Detail
  isTerminalPayment: boolean
  isAuthExpired: boolean
  isPaymentFailed: boolean
  /** Set only while the hold is expiring or has lapsed (authorizationHold). */
  authExpiresAt: Date | null
  /** Canceled after the card was charged: the gallery owes a refund. */
  refundNeeded: boolean
  /** Opens the refund panel and brings it into view. */
  onRefund: () => void
}

/**
 * The must-not-miss states, between the header and the progress (orders.md §2).
 * Titles from orders.md, explanations as before, no emoji.
 */
export function OrderWarnings({
  order,
  isTerminalPayment,
  isAuthExpired,
  isPaymentFailed,
  authExpiresAt,
  refundNeeded,
  onRefund,
}: OrderWarningsProps) {
  const lapsed = authExpiresAt !== null && authExpiresAt.getTime() <= Date.now()

  return (
    <>
      {isTerminalPayment && !isAuthExpired && (
        <Callout tone="plain">
          This order is {order.paymentStatus} — view only. No further action is needed.
        </Callout>
      )}

      {isAuthExpired && (
        <Callout tone="red" title="Authorization expired, no payment collected.">
          The buyer&apos;s card hold lapsed before the payment was captured, so{' '}
          <strong>no money was taken</strong> and there is nothing to fulfill. If they still want
          the print, they&apos;ll need to purchase again. You can remove this order from the Test
          data panel below.
        </Callout>
      )}

      {isPaymentFailed && (
        <Callout tone="red" title="Payment failed, card declined.">
          The buyer&apos;s card was declined, so <strong>no money was taken</strong> and there is
          nothing to fulfill. No action is required unless you want to follow up. You can remove
          this order from the Test data panel below.
        </Callout>
      )}

      {authExpiresAt && (
        <Callout
          tone="amber"
          title={
            lapsed
              ? 'Authorization may have expired.'
              : `Card on hold until ${formatDateTime(authExpiresAt.toISOString())}. Capture before then.`
          }
        >
          Stripe holds the buyer&apos;s card for about {AUTHORIZATION_LIFETIME_DAYS} days. This hold{' '}
          {lapsed ? 'was expected to lapse' : 'lapses'} around{' '}
          <strong>{formatDateTime(authExpiresAt.toISOString())}</strong>. Capture the payment
          (button below) before then or the sale — <strong>{formatEuro(order.totalCents)}</strong> —
          is lost.
        </Callout>
      )}

      {refundNeeded && (
        <Callout
          tone="amber"
          title="Refund needed."
          action={
            <Button
              variant="bare"
              font="dashboard"
              className={c(styles.btn, styles.btnOutline)}
              label="Refund the buyer"
              onClick={onRefund}
            />
          }
        >
          This order is canceled but the buyer&apos;s card was already charged{' '}
          <strong>{formatEuro(order.totalCents)}</strong>. Use the <strong>Refund the buyer</strong>{' '}
          button to return the money.
        </Callout>
      )}
    </>
  )
}
