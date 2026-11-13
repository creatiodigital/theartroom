'use client'

import { Check, Warning } from '@phosphor-icons/react'
import c from 'classnames'

import { Panel } from '@/components/admin/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { daysSinceDelivered, PAYOUT_SAFE_WINDOW_DAYS } from '@/lib/orders/payoutPolicy'
import { formatEuro } from '@/lib/print-providers/format'

import type { AdminOrderDetail as Detail } from '@/app/admin/orders/actions'

import { ItemPayout } from './ItemPayout'
import { formatDateTime } from './orderDetailModel'

import styles from './OrderDetail.module.scss'

type PayArtistsProps = {
  order: Detail
  /** cart: one ItemPayout per line; legacy: the header pay block. */
  mode: 'cart' | 'legacy'
  /** Re-reads the order after a line is paid. */
  onItemPaid: () => Promise<void>
  legacy: {
    paying: boolean
    payError: string | null
    /** Opens the "Pay the artist?" confirm. */
    onPayWithStripe: () => void
    manual: {
      open: boolean
      method: string
      reference: string
      note: string
      onMethodChange: (value: string) => void
      onReferenceChange: (value: string) => void
      onNoteChange: (value: string) => void
      submitting: boolean
      error: string | null
      onOpen: () => void
      onSubmit: () => void
      onClose: () => void
    }
  }
}

/** "Pay the artists", shown once the order is delivered (orders.md §2). */
export function PayArtists({ order, mode, onItemPaid, legacy }: PayArtistsProps) {
  return (
    <div id="pay-artists" className={styles.anchor}>
      {mode === 'cart' ? (
        <CartPayouts order={order} onItemPaid={onItemPaid} />
      ) : (
        <LegacyPayout order={order} {...legacy} />
      )}
    </div>
  )
}

function CartPayouts({ order, onItemPaid }: { order: Detail; onItemPaid: () => Promise<void> }) {
  const paidCount = order.items.filter(
    (it) => it.paidOutAt && it.transferStatus !== 'reversed',
  ).length
  const allPaid = paidCount === order.items.length
  const partly = paidCount > 0 && !allPaid

  return (
    <Panel title="Pay the artists">
      <p className={styles.panelText}>
        Each artist is paid independently to their connected Stripe account.{' '}
        {allPaid ? (
          <strong className={styles.textGreen}>All {order.items.length} items paid out.</strong>
        ) : partly ? (
          <strong className={styles.textAmber}>
            Partly paid out — {paidCount} of {order.items.length} items paid.
          </strong>
        ) : (
          <span>None paid out yet.</span>
        )}
      </p>
      <ul className={styles.lines}>
        {order.items.map((it) => (
          <li key={it.id} className={c(styles.line, styles.payLine)}>
            <div>
              <div className={styles.lineTitle}>{it.artworkTitle}</div>
              <div className={styles.lineMeta}>{it.artistName}</div>
            </div>
            <dl className={styles.lineMoney}>
              <dt>Artist cut</dt>
              <dd className={styles.amount}>{formatEuro(it.artistCents)}</dd>
            </dl>
            <div className={styles.payControl}>
              <ItemPayout item={it} onDone={onItemPaid} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

// The list page's Delivered-tab link lands here, so the admin sees the full
// context before confirming a real money transfer. Hidden once the artist has
// been paid (paidOutAt set, by Stripe Connect transfer or a manual payment).
function LegacyPayout({
  order,
  paying,
  payError,
  onPayWithStripe,
  manual,
}: { order: Detail } & PayArtistsProps['legacy']) {
  const days = daysSinceDelivered(order.shippedAt)
  const past = days !== null && days >= PAYOUT_SAFE_WINDOW_DAYS
  const remaining = days === null ? null : Math.max(0, PAYOUT_SAFE_WINDOW_DAYS - days)

  return (
    <Panel title="Pay the artist">
      <p className={styles.panelText}>
        Release the artist&apos;s share to their connected Stripe account. Buyer&apos;s name and
        address are never shared.
      </p>

      <div className={c(styles.box, past ? styles.boxGreen : styles.boxAmber)}>
        <div>
          <strong>Amount to pay:</strong> {formatEuro(order.artistCents)} → {order.artist.name}
        </div>
        <div>
          <strong>Delivered:</strong>{' '}
          {order.shippedAt ? formatDateTime(order.shippedAt) : 'unknown'}{' '}
          {days !== null ? `(${days} day${days === 1 ? '' : 's'} ago)` : ''}
        </div>
        <div>
          <strong>Safe window ({PAYOUT_SAFE_WINDOW_DAYS} days):</strong>{' '}
          {past ? (
            <span className={styles.textGreen}>
              <Check size={14} weight="bold" aria-hidden className={styles.inlineIcon} />
              Passed — paying now is low-risk for buyer disputes.
            </span>
          ) : (
            <span className={styles.textAmber}>
              <Warning size={14} weight="fill" aria-hidden className={styles.inlineIcon} />
              {remaining} day{remaining === 1 ? '' : 's'} remaining. Paying now is your call — if
              the buyer disputes the order later, recovering the artist&apos;s share will be on you.
            </span>
          )}
        </div>
      </div>

      {!order.artist.stripeOnboardingComplete && (
        <p className={c(styles.box, styles.boxRed)}>
          <strong>Artist hasn&apos;t completed Stripe Connect onboarding.</strong> The transfer will
          fail. Ask {order.artist.name} to finish onboarding before you can pay them.
        </p>
      )}

      {payError && <p className={styles.error}>{payError}</p>}

      <div className={styles.panelActions}>
        <Button
          variant="bare"
          font="dashboard"
          className={c(styles.btn, styles.btnPrimary)}
          label={paying ? 'Paying…' : 'Pay with Stripe'}
          onClick={onPayWithStripe}
          disabled={paying || manual.submitting || !order.artist.stripeOnboardingComplete}
        />
        <Button
          variant="bare"
          font="dashboard"
          className={c(styles.btn, styles.btnOutline)}
          label="Pay manually"
          onClick={manual.onOpen}
          disabled={paying || manual.submitting}
        />
      </div>

      {manual.open && (
        <div className={styles.inlinePanel}>
          <p className={styles.panelIntro}>
            Use this if you paid {order.artist.name} outside Stripe Connect (e.g. SEPA from your
            bank, Wise, PayPal). The order will be marked paid and moved to Done — but no Stripe
            transfer happens. The artist is not auto-emailed; please notify them yourself.
          </p>

          <div className={styles.field}>
            <label htmlFor="manual-method" className={styles.fieldLabel}>
              Method (e.g. SEPA, Wise, PayPal)
            </label>
            <Input
              id="manual-method"
              type="text"
              size="bare"
              inputClassName={styles.input}
              value={manual.method}
              onChange={(e) => manual.onMethodChange(e.target.value)}
              placeholder="SEPA"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="manual-reference" className={styles.fieldLabel}>
              Reference (optional — bank transfer ID, etc.)
            </label>
            <Input
              id="manual-reference"
              type="text"
              size="bare"
              inputClassName={styles.input}
              value={manual.reference}
              onChange={(e) => manual.onReferenceChange(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="manual-note" className={styles.fieldLabel}>
              Note (optional)
            </label>
            <textarea
              id="manual-note"
              value={manual.note}
              onChange={(e) => manual.onNoteChange(e.target.value)}
              rows={2}
              className={styles.input}
            />
          </div>

          {manual.error && <p className={styles.error}>{manual.error}</p>}

          <div className={styles.panelActions}>
            <Button
              variant="bare"
              font="dashboard"
              className={c(styles.btn, styles.btnPrimary)}
              label={manual.submitting ? 'Saving…' : `Mark paid (${formatEuro(order.artistCents)})`}
              onClick={manual.onSubmit}
              disabled={manual.submitting || manual.method.trim().length === 0}
            />
            <Button
              variant="bare"
              font="dashboard"
              className={c(styles.btn, styles.btnOutline)}
              label="Cancel"
              onClick={manual.onClose}
              disabled={manual.submitting}
            />
          </div>
        </div>
      )}
    </Panel>
  )
}
