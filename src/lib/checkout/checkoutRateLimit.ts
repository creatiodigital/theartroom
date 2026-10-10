import { headers } from 'next/headers'

import { getClientIpFromHeaders } from '@/lib/getClientIp'
import { rateLimit } from '@/lib/rateLimit'

/**
 * Per-IP throttles on the checkout server actions — the only public entry
 * points that do real work per call (catalog pricing, Stripe, and for limited
 * editions an edition-number hold).
 *
 * What they stop is a SCRIPT, not a buyer: hammering the actions to load the
 * server, cycling test/stolen cards through fresh PaymentIntents, or opening
 * checkout over and over to hold an edition's copies without paying (a number
 * is reserved when the PaymentIntent is created, and an abandoned one keeps it
 * until the reconcile cron settles it — up to a day). A real buyer opens
 * payment once, a few times if they change their address; every limit below
 * sits well clear of that.
 *
 * Card details never reach this server — they go from the browser straight to
 * Stripe, whose Radar screens card testing. These limits cover what does reach
 * us: each attempt to OPEN a payment.
 *
 * Enforced on Vercel only. There `x-real-ip` is set by the platform and cannot
 * be forged, so the key is the real client. Locally there is no trustworthy IP
 * (every request is localhost), and the e2e money-path specs call these actions
 * in-process, outside any request, dozens of times a run.
 */
const LIMITS = {
  // Opening a payment (creating a Stripe PaymentIntent).
  payment: [
    { name: 'checkout-payment', limit: 10, windowSeconds: 10 * 60 },
    { name: 'checkout-payment-daily', limit: 30, windowSeconds: 24 * 60 * 60 },
  ],
  // Opening a payment that holds limited-edition copies. Counted on top of
  // `payment`, and kept low: this is the call that takes stock off the shelf.
  limitedHold: [{ name: 'checkout-limited-hold-daily', limit: 10, windowSeconds: 24 * 60 * 60 }],
  // Re-pricing the cart on the address step. Cheaper, so looser.
  validate: [{ name: 'checkout-validate', limit: 30, windowSeconds: 10 * 60 }],
} as const

export type CheckoutLimit = keyof typeof LIMITS

// It never says "you look like a bot": a buyer behind a shared connection can
// trip it too, so it gives them a way to finish the order regardless.
export const CHECKOUT_RATE_LIMITED =
  "Too many checkout attempts from your connection. Please wait a few minutes and try again — or email contact@theartroom.gallery and we'll complete your order by hand."

/** True when this request is over any of the given limits. Counts the attempt. */
export async function isCheckoutRateLimited(...kinds: CheckoutLimit[]): Promise<boolean> {
  if (process.env.VERCEL !== '1') return false

  const ip = getClientIpFromHeaders(await headers())
  const results = await Promise.all(
    kinds.flatMap((kind) => LIMITS[kind].map((l) => rateLimit({ ...l, key: ip }))),
  )
  return results.some((r) => !r.success)
}
