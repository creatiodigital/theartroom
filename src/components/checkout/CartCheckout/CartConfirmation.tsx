'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Check, SealCheck } from '@phosphor-icons/react'

import {
  CheckoutAside,
  CheckoutButton,
  OrderItems,
  Totals,
} from '@/components/checkout/CheckoutParts'
import { ArrowLink } from '@/components/ui/ArrowLink'
import type { CartItem } from '@/lib/cart/types'
import type { DisplayAddress, DisplayTotals } from '@/lib/orders/confirmationSummary'
import { ensureOrderAction } from '@/lib/orders/ensureOrderAction'
import {
  EDITION_NUMBER_NOTICE_BODY,
  EDITION_NUMBER_NOTICE_HEADING,
} from '@/lib/editions/editionNumberNotice'
import { getCountryName } from '@/lib/print-providers/dialCodes'

import { UnboxingReminderModal } from './UnboxingReminderModal'
import styles from './CartConfirmation.module.scss'

/** The "Your order" panel: what the page still holds after paying in place, or else what
 *  `ensureOrderAction` reads from the verified order (3DS / PayPal return, reload; Q-P15 a).
 *  Display only. */
export type PlacedOrderSummary = {
  items: CartItem[]
  totals: DisplayTotals
  address: DisplayAddress
}

type CartConfirmationProps = {
  /** The authorized PaymentIntent id — shown as the order reference. */
  paymentIntentId: string
  summary?: PlacedOrderSummary | null
}

/** order-confirmed.dc.html: the text column, and the order panel when there is one. */
const ConfirmationLayout = ({
  summary,
  children,
}: {
  summary?: PlacedOrderSummary | null
  children: ReactNode
}) => (
  <div className={summary ? styles.layout : styles.layoutSingle}>
    <div className={styles.main}>{children}</div>
    {summary && (
      <CheckoutAside title="Your order">
        <OrderItems items={summary.items} />
        <Totals totals={summary.totals} totalLabel="Total, authorized" />
        <div className={styles.shipTo}>
          <span className={styles.caps}>Shipping to</span>
          <span className={styles.shipToText}>
            {summary.address.fullName}
            <br />
            {[
              summary.address.address1,
              summary.address.address2,
              `${summary.address.postalCode} ${summary.address.city}`.trim(),
              summary.address.stateOrRegion,
            ]
              .filter(Boolean)
              .join(', ')}{' '}
            · {getCountryName(summary.address.countryCode)}
          </span>
        </div>
      </CheckoutAside>
    )}
  </div>
)

/** "What happens next": the three stages, the first one done. */
const NEXT_STEPS = [
  { title: 'Order confirmed', text: 'Payment authorized. Nothing is charged yet.' },
  {
    title: 'In production',
    text: 'Your prints are made by the print lab. The payment is taken at this point.',
  },
  { title: 'Shipped', text: 'Tracked delivery. We email you the tracking link.' },
]

type Status = 'finalizing' | 'confirmed' | 'failed'

/** Per-order key, so the reminder shows once and a reload doesn't nag. */
const REMINDER_DISMISSED_KEY = 'the-art-room:unboxing-reminder:'

/** sessionStorage throws in Safari private mode — a reminder is never worth
 *  breaking the confirmation screen over, so both accessors swallow. */
function reminderAlreadySeen(paymentIntentId: string): boolean {
  try {
    return sessionStorage.getItem(`${REMINDER_DISMISSED_KEY}${paymentIntentId}`) !== null
  } catch {
    return false
  }
}

function markReminderSeen(paymentIntentId: string): void {
  try {
    sessionStorage.setItem(`${REMINDER_DISMISSED_KEY}${paymentIntentId}`, '1')
  } catch {
    /* no-op */
  }
}

/**
 * Cart confirmation step.
 *
 * The "your order is confirmed" message is shown ONLY after the order is
 * verified to exist in our DB — never from the PaymentIntent alone. On arrival
 * this calls ensureOrderAction, which creates the order idempotently if the
 * webhook hasn't yet, so a dead/missing webhook can never leave the buyer with
 * a paid card and no order. If the order genuinely can't be created, we show an
 * honest "we couldn't finalize" state instead of a false confirmation — the
 * card is only authorized (not charged) and the admin is alerted server-side.
 *
 * Covers BOTH entry points (3DS redirect + direct payment success) because both
 * render this component.
 */
export const CartConfirmation = ({ paymentIntentId, summary }: CartConfirmationProps) => {
  const [status, setStatus] = useState<Status>('finalizing')
  const [orderRef, setOrderRef] = useState<string | null>(null)
  const [hasLimitedEdition, setHasLimitedEdition] = useState(false)
  const [showReminder, setShowReminder] = useState(false)
  // The order as the server read it, once the payment is verified: the panel on every path.
  const [orderSummary, setOrderSummary] = useState<PlacedOrderSummary | null>(null)

  useEffect(() => {
    let active = true
    ensureOrderAction(paymentIntentId)
      .then((res) => {
        if (!active) return
        setStatus(res.ok ? 'confirmed' : 'failed')
        if (res.orderRef) setOrderRef(res.orderRef)
        setHasLimitedEdition(res.hasLimitedEdition === true)
        if (res.summary) setOrderSummary(res.summary)
      })
      .catch(() => {
        if (active) setStatus('failed')
      })
    return () => {
      active = false
    }
  }, [paymentIntentId])

  // Ask for unboxing images once the order is actually confirmed — never on
  // the failed path, where the buyer has a real problem to worry about first.
  useEffect(() => {
    if (status !== 'confirmed') return
    if (reminderAlreadySeen(paymentIntentId)) return
    setShowReminder(true)
  }, [status, paymentIntentId])

  const dismissReminder = () => {
    setShowReminder(false)
    markReminderSeen(paymentIntentId)
  }

  if (status === 'finalizing') {
    return (
      <ConfirmationLayout>
        <h1 className={styles.headline}>Finalizing your order…</h1>
        <p className={styles.body}>One moment while we confirm your order.</p>
      </ConfirmationLayout>
    )
  }

  if (status === 'failed') {
    return (
      <ConfirmationLayout>
        <h1 className={styles.headline}>Payment received — we&apos;re finalizing your order</h1>
        <p className={styles.body}>
          Your card has been authorized but <strong>not charged</strong>. We hit a snag recording
          your order and have already been notified — we&apos;ll email you to confirm it shortly and
          put right anything that&apos;s wrong. Please don&apos;t pay again.
        </p>
        <div className={styles.reference}>
          <span className={styles.caps}>Reference</span>
          <span className={styles.referenceValue}>{paymentIntentId}</span>
        </div>
        <div className={styles.actions}>
          <CheckoutButton href="/prints" label="Browse more prints" fullWidth={false} />
        </div>
      </ConfirmationLayout>
    )
  }

  return (
    <ConfirmationLayout summary={summary ?? orderSummary}>
      <span className={styles.check} aria-hidden>
        <Check size={26} weight="light" />
      </span>
      <h1 className={styles.headline}>Thank you, your order is confirmed.</h1>
      {/* Says "payment", never "card". Manual capture is offered on every
          method Stripe gives us — a PayPal buyer was being told about a card
          they never used. Method-agnostic wording stays true for whatever the
          Payment Element offers next, without plumbing the method through. */}
      <p className={styles.body}>
        Your payment is authorized and your order is now being prepared. We&apos;ll take the payment
        once your prints enter production, and send a confirmation email with tracking details as
        soon as they ship.
      </p>

      {/* The buyer's ONE reference — identical to the string on every email and
          the invoice, so quoting it back to us always finds this order. The
          PaymentIntent id stays out of the customer's way; it appears only on
          the failed path above, where it is the only identifier that exists. */}
      <div className={styles.reference}>
        <span className={styles.caps}>Order reference</span>
        <span className={styles.referenceValue}>{orderRef ?? paymentIntentId}</span>
        <span className={styles.referenceNote}>Also in your confirmation email</span>
      </div>

      <div className={styles.next}>
        <h2 className={styles.caps}>What happens next</h2>
        <ol className={styles.nextList}>
          {NEXT_STEPS.map((step, index) => (
            <li key={step.title} className={styles.nextStep}>
              <span className={index === 0 ? styles.nextMarkDone : styles.nextMark} aria-hidden>
                {index === 0 ? <Check size={14} weight="bold" /> : index + 1}
              </span>
              <span className={styles.nextText}>
                <span className={styles.nextTitle}>{step.title}</span>
                <span className={styles.nextBody}>{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Limited lines only: an open-edition buyer has no number coming and
          should not be told to wait for one. The number IS already assigned,
          but naming it here would promise a copy a cancellation could take
          back — see editionNumberNotice for the full reasoning. */}
      {hasLimitedEdition && (
        <div className={styles.editionNotice}>
          <SealCheck size={20} weight="light" aria-hidden className={styles.editionIcon} />
          <div className={styles.editionText}>
            <span className={styles.editionHeading}>{EDITION_NUMBER_NOTICE_HEADING}</span>
            <p className={styles.editionBody}>{EDITION_NUMBER_NOTICE_BODY}</p>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <CheckoutButton href="/prints" label="Browse more prints" fullWidth={false} />
        <ArrowLink href="/exhibitions">Visit the exhibitions</ArrowLink>
      </div>

      {showReminder && <UnboxingReminderModal onClose={dismissReminder} />}
    </ConfirmationLayout>
  )
}
