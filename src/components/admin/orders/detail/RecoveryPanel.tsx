'use client'

import c from 'classnames'

import { Panel } from '@/components/admin/ui/Panel'
import { Button } from '@/components/ui/Button'
import { REORDER_REASONS, REORDER_REASON_LABELS } from '@/lib/orders/reorderReasons'
import { formatEuro } from '@/lib/print-providers/format'

import type { AdminOrderDetail as Detail } from '@/app/admin/orders/actions'

import styles from './OrderDetail.module.scss'

type RecoveryPanelProps = {
  order: Detail
  reorder: {
    /** Paid, and a print physically exists (in production, shipped or delivered). */
    available: boolean
    open: boolean
    reason: string
    note: string
    onReasonChange: (value: string) => void
    onNoteChange: (value: string) => void
    reordering: boolean
    error: string | null
    onOpen: () => void
    onSubmit: () => void
    onClose: () => void
  }
  refund: {
    /** Authorized or captured: there is a hold to release or money to return. */
    refundable: boolean
    alreadyRefunded: boolean
    open: boolean
    reason: string
    onReasonChange: (value: string) => void
    refunding: boolean
    error: string | null
    /** Lets the Refund-needed warning bring the open panel into view. */
    panelRef: (node: HTMLDivElement | null) => void
    onOpen: () => void
    /** Opens the "Refund the buyer?" confirm. */
    onSubmit: () => void
    onClose: () => void
  }
}

/**
 * Side column, "If something goes wrong": the replacement reprint and the
 * refund, each opening its own inline panel (orders.md §2).
 */
export function RecoveryPanel({ order, reorder, refund }: RecoveryPanelProps) {
  const outline = c(styles.btn, styles.btnOutline)

  return (
    <Panel title="If something goes wrong" className={styles.sidePanel}>
      {/* Re-order / replacement reprint: resets the order to "To place at TPS"
          for a fresh copy WITHOUT re-charging; the same edition number is remade. */}
      {reorder.available &&
        (!reorder.open ? (
          <Button
            variant="bare"
            font="dashboard"
            className={c(outline, styles.btnStart)}
            label="Reprint as a replacement…"
            onClick={reorder.onOpen}
          />
        ) : (
          <div className={styles.inlinePanel}>
            <p className={styles.panelIntro}>
              <strong>Re-order this print (replacement reprint)</strong> — resets the order to{' '}
              <strong>To place at TPS</strong> so you can send a fresh copy to the print partner.
              The buyer is <strong>not</strong> charged again and keeps their edition number.
            </p>

            {order.reorderCount >= 2 && (
              <p className={c(styles.box, styles.boxAmber)}>
                This order has already been reprinted <strong>{order.reorderCount}</strong> times —
                a refund may serve the buyer better. You can still proceed.
              </p>
            )}

            <div className={styles.field}>
              <label htmlFor="reorder-reason" className={styles.fieldLabel}>
                Reason
              </label>
              <select
                id="reorder-reason"
                value={reorder.reason}
                onChange={(e) => reorder.onReasonChange(e.target.value)}
                className={styles.input}
              >
                <option value="">Select a reason…</option>
                {REORDER_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {REORDER_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={reorder.note}
              onChange={(e) => reorder.onNoteChange(e.target.value)}
              rows={2}
              placeholder="Optional note (e.g. corner crushed in transit)"
              className={styles.input}
            />

            {reorder.error && <p className={styles.error}>{reorder.error}</p>}

            <div className={styles.panelActions}>
              <Button
                variant="bare"
                font="dashboard"
                className={c(styles.btn, styles.btnDanger)}
                label={reorder.reordering ? 'Re-ordering…' : 'Confirm re-order'}
                onClick={reorder.onSubmit}
                disabled={reorder.reordering || reorder.reason.length === 0}
              />
              <Button
                variant="bare"
                font="dashboard"
                className={outline}
                label="Cancel"
                onClick={reorder.onClose}
                disabled={reorder.reordering}
              />
            </div>
          </div>
        ))}

      {!refund.open && refund.refundable && (
        <Button
          variant="bare"
          font="dashboard"
          className={c(styles.btn, styles.btnDangerText, styles.btnStart)}
          label="Refund the buyer…"
          onClick={refund.onOpen}
        />
      )}
      {refund.alreadyRefunded && (
        <div className={styles.docRow}>
          <span className={styles.docBadge}>Refunded</span>
        </div>
      )}
      {!refund.refundable && !refund.alreadyRefunded && (
        <p className={styles.panelText}>Not refundable in current state ({order.paymentStatus}).</p>
      )}

      {refund.open && (
        <div ref={refund.panelRef} className={c(styles.inlinePanel, styles.anchor)}>
          <p className={styles.panelIntro}>
            <strong>Refund {formatEuro(order.totalCents)} to the buyer</strong>
            {order.paymentStatus === 'authorized'
              ? ' — no money has been charged yet; this releases the hold on their card.'
              : ' — this returns the money from our Stripe balance to the buyer’s card. Takes 5–10 business days to appear on their statement.'}
          </p>

          {order.paidOutAt && (
            <p className={c(styles.box, styles.boxAmber)}>
              <strong>Artist payout already released</strong> ({formatEuro(order.artistCents)}
              {order.transferId ? ' via Stripe' : ' manually'}). Refunding here will <em>not</em>{' '}
              claw that back — you&apos;ll need to recover it from the artist separately.
            </p>
          )}

          <div className={styles.field}>
            <label htmlFor="refund-reason" className={styles.fieldLabel}>
              Reason (internal, for audit log)
            </label>
            <textarea
              id="refund-reason"
              value={refund.reason}
              onChange={(e) => refund.onReasonChange(e.target.value)}
              rows={3}
              className={styles.input}
              placeholder="e.g. Buyer reported damaged frame, photos provided."
            />
          </div>

          {refund.error && <p className={styles.error}>{refund.error}</p>}

          <div className={styles.panelActions}>
            <Button
              variant="bare"
              font="dashboard"
              className={c(styles.btn, styles.btnDanger)}
              label="Issue refund"
              onClick={refund.onSubmit}
              disabled={refund.refunding || refund.reason.trim().length === 0}
            />
            <Button
              variant="bare"
              font="dashboard"
              className={outline}
              label="Cancel"
              onClick={refund.onClose}
              disabled={refund.refunding}
            />
          </div>
        </div>
      )}
    </Panel>
  )
}
