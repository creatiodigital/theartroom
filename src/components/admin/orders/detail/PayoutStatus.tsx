'use client'

import c from 'classnames'

import { formatDateTime } from './orderDetailModel'

import styles from './OrderDetail.module.scss'

type PayoutStatusProps = {
  paidOutAt: string | null
  transferStatus: string | null
}

/**
 * One line's artist payout: dot + text. Cart orders pay each artist per line
 * (per-item Stripe Connect transfer); a legacy order passes its header fields.
 */
export function PayoutStatus({ paidOutAt, transferStatus }: PayoutStatusProps) {
  // A clawed-back line keeps its (stale) paidOutAt, so check 'reversed' FIRST —
  // otherwise the paidOutAt branch would render it as still 'Paid' on a refunded
  // order, which is misleading. The reversal date is on the order's event log.
  if (transferStatus === 'reversed') {
    return (
      <span className={styles.payoutStatus}>
        <span aria-hidden className={c(styles.dot, styles.dotRed)} />
        Reversed (refunded)
      </span>
    )
  }
  if (paidOutAt) {
    const isManual = transferStatus === 'paid_manual'
    return (
      <span className={styles.payoutStatus}>
        <span aria-hidden className={c(styles.dot, styles.dotGreen)} />
        Paid {formatDateTime(paidOutAt)}
        {isManual ? ' (manual)' : ''}
      </span>
    )
  }
  return (
    <span className={c(styles.payoutStatus, styles.muted)}>
      <span aria-hidden className={c(styles.dot, styles.dotGray)} />
      Not paid
    </span>
  )
}
