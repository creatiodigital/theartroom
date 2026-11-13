'use server'

import prisma from '@/lib/prisma'
import { isPaymentIntentId } from '@/lib/stripe/paymentIntentId'
import { getConfirmationSummary, type ConfirmationSummary } from './confirmationSummary'
import { ensureOrderForPaymentIntent } from './ensureOrderForPaymentIntent'
import { formatOrderRef } from './orderRef'

/**
 * Client-callable wrapper around ensureOrderForPaymentIntent, used by the buyer
 * confirmation step to GATE the "your order is confirmed" message: it returns
 * ok only once a real PrintOrder exists (creating it idempotently if the webhook
 * hasn't).
 *
 * Returns the buyer-facing order REFERENCE alongside the flag — the same string
 * every email and the invoice print, so the confirmation screen can show the
 * customer the one identifier they should ever quote back to us. The internal
 * UUID stays server-side; only its 8-character reference crosses to the client.
 *
 * Also reports whether the order holds a limited edition, which decides the
 * "your edition number" notice. Derived from the ORDER rather than the cart the
 * buyer just had: the cart is emptied on success, so a reload has nothing left
 * to read, and the confirmation must survive a reload.
 *
 * And, for the same reason, the order's lines, totals and shipping address for the "Your order"
 * panel (questions.md Q-P15 a, owner 2026-11-12): read ONLY after the payment for that reference
 * is verified (the order exists, or was just created from an authorized PaymentIntent), read only,
 * never the buyer's email or phone. A failure to read them never fails the confirmation: the page
 * then shows the text column alone, as before.
 */
export async function ensureOrderAction(paymentIntentId: string): Promise<{
  ok: boolean
  orderRef?: string
  hasLimitedEdition?: boolean
  summary?: ConfirmationSummary | null
}> {
  if (!isPaymentIntentId(paymentIntentId)) return { ok: false }
  const res = await ensureOrderForPaymentIntent(paymentIntentId)
  if (!res.ok) return { ok: false }
  // An edition number bound to the order is the fact itself — truer than
  // re-deriving "was this limited?" from a config snapshot.
  const [limitedCount, summary] = await Promise.all([
    prisma.editionNumber.count({
      where: { OR: [{ orderId: res.orderId }, { orderItem: { orderId: res.orderId } }] },
    }),
    getConfirmationSummary(res.orderId).catch(() => null),
  ])
  return {
    ok: true,
    orderRef: formatOrderRef(res.orderId),
    hasLimitedEdition: limitedCount > 0,
    summary,
  }
}
