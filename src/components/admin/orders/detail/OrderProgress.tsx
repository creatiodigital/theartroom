'use client'

import { useId, type ReactNode } from 'react'
import c from 'classnames'

import { ProgressSteps, type ProgressStep } from '@/components/admin/ui/ProgressSteps'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Bucket } from '@/lib/orders/orderBuckets'

import type { AdminOrderDetail as Detail } from '@/app/admin/orders/actions'

import styles from './OrderDetail.module.scss'

type Busy = 'capture' | 'placed' | 'started' | 'shipped' | 'delivered' | null

type OrderProgressProps = {
  order: Detail
  bucket: Bucket
  steps: ProgressStep[]
  end?: string
  stage: string | null
  isTerminalPayment: boolean
  canCancel: boolean
  busy: Busy
  busyError: string | null
  onCapture: () => void
  onPlacedAtTps: () => void
  onStarted: () => void
  onDelivered: () => void
  ship: {
    open: boolean
    trackingUrl: string
    onTrackingUrlChange: (value: string) => void
    onOpen: () => void
    onSubmit: () => void
    onClose: () => void
  }
  cancel: {
    open: boolean
    reason: string
    onReasonChange: (value: string) => void
    canceling: boolean
    error: string | null
    onOpen: () => void
    onSubmit: () => void
    onKeep: () => void
  }
}

/** One sentence per stage for the Next step box (orders.md §2; wording from §1's guidance). */
function stageSentence(order: Detail, bucket: Bucket): ReactNode {
  switch (bucket) {
    case 'new':
      return 'Capture the payment. Once it succeeds, the order moves to “To place at TPS”.'
    case 'to-place':
      return 'Place and pay this order at theprintspace using the details below, then mark it placed.'
    case 'at-tps':
      return 'Mark it in production once theprintspace confirms they are printing.'
    case 'production':
      return 'When TPS ships it, add the tracking link and mark it shipped.'
    case 'shipped':
      return 'Mark it delivered once the buyer has it.'
    case 'delivered':
      return order.isCart ? (
        <>
          Pay each artist in <a href="#pay-artists">Pay the artists</a> below.
        </>
      ) : (
        <>
          Pay the artist in <a href="#pay-artists">Pay the artist</a> below.
        </>
      )
    case 'done':
      return 'Complete. Delivered and the artist is paid. Nothing left to do.'
    case 'cancelled':
      return order.paymentStatus === 'succeeded'
        ? 'Canceled after the card was charged: refund the buyer.'
        : 'Canceled. Nothing left to do.'
    case 'refunded':
      return 'Refunded. Nothing left to do.'
    case 'attention':
      return 'Something is off with this order. Check the timeline below.'
  }
}

/**
 * The fulfillment trail and the Next step box under it. The box holds the one
 * forward action for the stage, Cancel order, and the inline ship and cancel
 * panels. The pipeline is forward-only: a backward step would just send the
 * buyer contradictory emails.
 */
export function OrderProgress({
  order,
  bucket,
  steps,
  end,
  stage,
  isTerminalPayment,
  canCancel,
  busy,
  busyError,
  onCapture,
  onPlacedAtTps,
  onStarted,
  onDelivered,
  ship,
  cancel,
}: OrderProgressProps) {
  const headingId = useId()

  const waitingForPayment =
    stage === null && order.paymentStatus !== 'authorized' && order.paymentStatus !== 'succeeded'
  const showCapture = stage === null && order.paymentStatus === 'authorized'
  const showPlaced = stage === null && order.paymentStatus === 'succeeded'
  const showStarted = stage === 'Placed'
  const showShip = stage === 'Started'
  const showDelivered = stage === 'Shipped'
  const hasActions =
    !isTerminalPayment &&
    (showCapture || showPlaced || showStarted || showShip || showDelivered || canCancel)

  const sentence = isTerminalPayment
    ? `This order is ${order.paymentStatus} — no further actions (view only).`
    : waitingForPayment
      ? 'Waiting for payment to authorize before you can capture.'
      : stageSentence(order, bucket)

  const primary = c(styles.btn, styles.btnPrimary)

  return (
    <section aria-labelledby={headingId} className={styles.progressPanel}>
      <h2 id={headingId} className="sr-only">
        Fulfillment
      </h2>
      <ProgressSteps label="Fulfillment progress" steps={steps} end={end} />

      <div className={styles.nextStep}>
        <div className={styles.nextStepHead}>
          <div className={styles.nextStepText}>
            <span className={styles.eyebrow}>Next step</span>
            <p className={styles.nextStepSentence}>{sentence}</p>
          </div>
          {hasActions && (
            // Primary first in the DOM (phones stack it on top); on desktop the
            // row is reversed so Cancel order sits to its left, as drawn.
            <div className={styles.ctaRow}>
              {showCapture && (
                <Button
                  variant="bare"
                  font="dashboard"
                  className={primary}
                  label={busy === 'capture' ? 'Capturing…' : 'Capture payment'}
                  onClick={onCapture}
                  disabled={busy !== null}
                />
              )}
              {showPlaced && (
                <Button
                  variant="bare"
                  font="dashboard"
                  className={primary}
                  label={busy === 'placed' ? 'Marking…' : 'Mark placed at TPS'}
                  onClick={onPlacedAtTps}
                  disabled={busy !== null}
                />
              )}
              {showStarted && (
                <Button
                  variant="bare"
                  font="dashboard"
                  className={primary}
                  label={busy === 'started' ? 'Marking…' : 'Mark in production (notify buyer)'}
                  onClick={onStarted}
                  disabled={busy !== null}
                />
              )}
              {showShip && (
                <Button
                  variant="bare"
                  font="dashboard"
                  className={primary}
                  label={busy === 'shipped' ? 'Marking…' : 'Mark shipped (notify buyer)'}
                  onClick={ship.onOpen}
                  disabled={busy !== null}
                />
              )}
              {showDelivered && (
                <Button
                  variant="bare"
                  font="dashboard"
                  className={primary}
                  label={busy === 'delivered' ? 'Marking…' : 'Mark delivered (notify buyer)'}
                  onClick={onDelivered}
                  disabled={busy !== null}
                />
              )}
              {/* Off-ramp, available until terminal. Not a forward step in the
                  pipeline — it pulls the order out of the flow entirely (and
                  triggers refund-needed messaging if the card was already
                  charged). It stays visible while its panel is open (Q15). */}
              {canCancel && (
                <Button
                  variant="bare"
                  font="dashboard"
                  className={c(styles.btn, styles.btnOutline)}
                  label="Cancel order"
                  onClick={cancel.onOpen}
                  disabled={busy !== null}
                />
              )}
            </div>
          )}
        </div>

        {busyError && <p className={styles.error}>{busyError}</p>}

        {ship.open && (
          <div className={c(styles.inlinePanel, styles.inlinePanelOnGray)}>
            <p className={styles.panelIntro}>
              <strong>Mark this order as shipped.</strong> Paste the tracking URL TPS provided so
              the buyer&apos;s email can link straight to it. Leave blank if you don&apos;t have one
              yet.
            </p>
            <div className={styles.field}>
              <label htmlFor="tracking-url" className={styles.fieldLabel}>
                Tracking URL (optional)
              </label>
              <Input
                id="tracking-url"
                type="url"
                size="bare"
                inputClassName={styles.input}
                value={ship.trackingUrl}
                onChange={(e) => ship.onTrackingUrlChange(e.target.value)}
                placeholder="https://tracking.example.com/..."
              />
            </div>
            <div className={styles.panelActions}>
              <Button
                variant="bare"
                font="dashboard"
                className={primary}
                label={busy === 'shipped' ? 'Marking…' : 'Mark shipped'}
                onClick={ship.onSubmit}
                disabled={busy !== null}
              />
              <Button
                variant="bare"
                font="dashboard"
                className={c(styles.btn, styles.btnOutline)}
                label="Cancel"
                onClick={ship.onClose}
                disabled={busy !== null}
              />
            </div>
          </div>
        )}

        {cancel.open && (
          <div className={c(styles.inlinePanel, styles.inlinePanelOnGray)}>
            <p className={styles.panelIntro}>
              <strong>Cancel this order</strong>
              {order.paymentStatus === 'authorized'
                ? ' — the Stripe hold will be voided immediately (no money moves).'
                : order.paymentStatus === 'succeeded'
                  ? ' — the payment was already captured; after canceling you’ll need to issue a refund separately.'
                  : '.'}
            </p>
            <div className={styles.field}>
              <label htmlFor="cancel-reason" className={styles.fieldLabel}>
                Reason (internal, for audit log)
              </label>
              <textarea
                id="cancel-reason"
                value={cancel.reason}
                onChange={(e) => cancel.onReasonChange(e.target.value)}
                rows={3}
                placeholder="e.g. Buyer asked to cancel; or TPS rejected the file for low resolution."
                className={styles.input}
              />
            </div>
            {cancel.error && <p className={styles.error}>{cancel.error}</p>}
            <div className={styles.panelActions}>
              <Button
                variant="bare"
                font="dashboard"
                className={c(styles.btn, styles.btnDanger)}
                label={cancel.canceling ? 'Canceling…' : 'Cancel order'}
                onClick={cancel.onSubmit}
                disabled={cancel.canceling || cancel.reason.trim().length === 0}
              />
              <Button
                variant="bare"
                font="dashboard"
                className={c(styles.btn, styles.btnOutline)}
                label="Keep order"
                onClick={cancel.onKeep}
                disabled={cancel.canceling}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
