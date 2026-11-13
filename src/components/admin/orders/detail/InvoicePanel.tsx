'use client'

import c from 'classnames'

import { Panel } from '@/components/admin/ui/Panel'
import { Button } from '@/components/ui/Button'

import type { AdminOrderDetail as Detail } from '@/app/admin/orders/actions'

import styles from './OrderDetail.module.scss'

type InvoicePanelProps = {
  order: Detail
  sendingInvoice: boolean
  invoiceError: string | null
  issuingCreditNote: boolean
  creditNoteError: string | null
  /** Opens the send / re-send confirm. */
  onSendInvoice: () => void
  /** Opens the "Issue credit note?" confirm. */
  onIssueCreditNote: () => void
  /** Re-sends the credit note straight away, without a confirm (Q15). */
  onResendCreditNote: () => void
}

function DocBadge({ label, tone }: { label: string; tone: 'neutral' | 'red' }) {
  return <span className={c(styles.docBadge, tone === 'red' && styles.docBadgeRed)}>{label}</span>
}

/**
 * Invoice — two states (no fulfillment gate; the admin issues at will):
 * 1. Invoice exists → number + "See invoice" + "Send invoice again" (re-send is
 *    idempotent — same PDF + number, as many times as needed). When a credit
 *    note also exists, the original invoice is shown as Voided.
 * 2. No invoice yet → "Send invoice" (available at any stage).
 * Email status isn't stored, so "Email failed" shows only right after a failed
 * send in this visit (Q12).
 */
export function InvoicePanel({
  order,
  sendingInvoice,
  invoiceError,
  issuingCreditNote,
  creditNoteError,
  onSendInvoice,
  onIssueCreditNote,
  onResendCreditNote,
}: InvoicePanelProps) {
  const outline = c(styles.btn, styles.btnCompact, styles.btnOutline)

  return (
    <Panel title="Invoice" className={styles.sidePanel}>
      {order.invoice ? (
        <>
          <div className={styles.docRow}>
            <span className={styles.docNumber}>{order.invoice.number}</span>
            {order.creditNote ? (
              <DocBadge label="Voided" tone="red" />
            ) : invoiceError ? (
              <DocBadge label="Email failed" tone="red" />
            ) : (
              <DocBadge label="Issued" tone="neutral" />
            )}
          </div>
          <div className={styles.panelActions}>
            <Button
              variant="bare"
              font="dashboard"
              className={outline}
              label="See invoice"
              href={`/admin/invoices/${order.invoice.id}/download`}
              prefetch={false}
            />
            {!order.creditNote && (
              <>
                <Button
                  variant="bare"
                  font="dashboard"
                  className={outline}
                  label={sendingInvoice ? 'Sending…' : 'Send invoice again'}
                  onClick={onSendInvoice}
                  disabled={sendingInvoice}
                />
                <Button
                  variant="bare"
                  font="dashboard"
                  className={outline}
                  label={issuingCreditNote ? 'Issuing…' : 'Issue credit note'}
                  onClick={onIssueCreditNote}
                  disabled={issuingCreditNote}
                />
              </>
            )}
          </div>

          {order.creditNote && (
            <div className={styles.creditNote}>
              <span className={styles.docLabel}>Credit note</span>
              <div className={styles.docRow}>
                <span className={styles.docNumber}>{order.creditNote.number}</span>
                {creditNoteError ? (
                  <DocBadge label="Email failed" tone="red" />
                ) : (
                  <DocBadge label="Issued" tone="neutral" />
                )}
              </div>
              <div className={styles.panelActions}>
                <Button
                  variant="bare"
                  font="dashboard"
                  className={outline}
                  label="See credit note"
                  href={`/admin/invoices/${order.creditNote.id}/download`}
                  prefetch={false}
                />
                <Button
                  variant="bare"
                  font="dashboard"
                  className={outline}
                  label={issuingCreditNote ? 'Sending…' : 'Send credit note again'}
                  onClick={onResendCreditNote}
                  disabled={issuingCreditNote}
                />
              </div>
            </div>
          )}

          {(invoiceError || creditNoteError) && (
            <p className={styles.error}>{invoiceError || creditNoteError}</p>
          )}
        </>
      ) : (
        <>
          <div className={styles.docRow}>
            <span className={styles.muted}>No invoice yet</span>
            <DocBadge label="Not issued" tone="neutral" />
          </div>
          <p className={styles.panelText}>
            Issue the invoice and email it to the buyer. The invoice number is minted once —
            re-sending reuses the same number.
          </p>
          <div className={styles.panelActions}>
            <Button
              variant="bare"
              font="dashboard"
              className={c(styles.btn, styles.btnCompact, styles.btnPrimary)}
              label={sendingInvoice ? 'Sending…' : 'Send invoice'}
              onClick={onSendInvoice}
              disabled={sendingInvoice}
            />
          </div>
          {invoiceError && <p className={styles.error}>{invoiceError}</p>}
        </>
      )}
    </Panel>
  )
}
