'use client'

import { useCallback, useState } from 'react'
import c from 'classnames'

import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatEuro } from '@/lib/print-providers/format'

import {
  markItemPaidManually,
  releaseItemPayout,
  type AdminOrderItem,
} from '@/app/admin/orders/actions'

import { PayoutStatus } from './PayoutStatus'

import styles from './OrderDetail.module.scss'

// Per-item payout control for cart orders. Cart orders pay each artist
// independently (one Stripe Connect transfer per line), so an order can be
// partly paid out. Each line carries its own confirm-modal + manual-payout
// form state, mirroring the header payout block's flow. Only rendered when
// the parent order is delivered (Complete). The server actions re-check the
// onboarding / Complete / no-double-pay guards and surface any failure here.
export const ItemPayout = ({
  item,
  onDone,
}: {
  item: AdminOrderItem
  onDone: () => Promise<void>
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [manualOpen, setManualOpen] = useState(false)
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  const handleStripe = useCallback(async () => {
    setPaying(true)
    setError(null)
    const res = await releaseItemPayout(item.id)
    setPaying(false)
    if (!res.ok) {
      setError(res.error)
      setConfirmOpen(false)
      return
    }
    setConfirmOpen(false)
    await onDone()
  }, [item.id, onDone])

  const handleManual = useCallback(async () => {
    setManualSubmitting(true)
    setManualError(null)
    const res = await markItemPaidManually(item.id, { method, reference, note })
    setManualSubmitting(false)
    if (!res.ok) {
      setManualError(res.error)
      return
    }
    setManualOpen(false)
    setMethod('')
    setReference('')
    setNote('')
    await onDone()
  }, [item.id, method, reference, note, onDone])

  if (item.paidOutAt) {
    return <PayoutStatus paidOutAt={item.paidOutAt} transferStatus={item.transferStatus} />
  }

  return (
    <div className={styles.itemPayout}>
      {/* Not gated on the artist's Stripe onboarding (the legacy block is): kept as is (Q15). */}
      <div className={styles.panelActions}>
        <Button
          variant="bare"
          font="dashboard"
          className={c(styles.btn, styles.btnCompact, styles.btnPrimary)}
          label={paying ? 'Paying…' : `Pay ${formatEuro(item.artistCents)} with Stripe`}
          onClick={() => {
            setError(null)
            setConfirmOpen(true)
          }}
          disabled={paying || manualSubmitting}
        />
        <Button
          variant="bare"
          font="dashboard"
          className={c(styles.btn, styles.btnCompact, styles.btnOutline)}
          label="Pay manually"
          onClick={() => {
            setManualError(null)
            setManualOpen(true)
          }}
          disabled={paying || manualSubmitting}
        />
      </div>
      {error && <p className={styles.error}>{error}</p>}

      {manualOpen && (
        <div className={styles.inlinePanel}>
          <p className={styles.panelIntro}>
            Record an off-Stripe payment to {item.artistName} ({formatEuro(item.artistCents)}). No
            Stripe transfer happens; the artist is not auto-emailed.
          </p>
          <Input
            type="text"
            size="bare"
            inputClassName={styles.input}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="Method (SEPA, Wise, …)"
          />
          <Input
            type="text"
            size="bare"
            inputClassName={styles.input}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Reference (optional)"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note (optional)"
            className={styles.input}
          />
          {manualError && <p className={styles.error}>{manualError}</p>}
          <div className={styles.panelActions}>
            <Button
              variant="bare"
              font="dashboard"
              className={c(styles.btn, styles.btnCompact, styles.btnPrimary)}
              label={manualSubmitting ? 'Saving…' : `Mark paid (${formatEuro(item.artistCents)})`}
              onClick={handleManual}
              disabled={manualSubmitting || method.trim().length === 0}
            />
            <Button
              variant="bare"
              font="dashboard"
              className={c(styles.btn, styles.btnCompact, styles.btnOutline)}
              label="Cancel"
              onClick={() => {
                setManualOpen(false)
                setMethod('')
                setReference('')
                setNote('')
                setManualError(null)
              }}
              disabled={manualSubmitting}
            />
          </div>
        </div>
      )}

      {confirmOpen && (
        <AdminConfirmModal
          title="Pay this artist?"
          message={
            <>
              This will transfer <strong>{formatEuro(item.artistCents)}</strong> to{' '}
              <strong>{item.artistName}</strong>&apos;s Stripe account for{' '}
              <strong>{item.artworkTitle}</strong>.
              <br />
              <br />
              Once released, the money is on the artist&apos;s side — you can&apos;t pull it back
              from this dashboard.
            </>
          }
          confirmLabel="Yes, pay this artist"
          cancelLabel="Cancel"
          destructive
          busy={paying}
          onConfirm={handleStripe}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}
