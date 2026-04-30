/**
 * Days we hold after the order is marked delivered before the artist's
 * payout button becomes eligible. Covers the typical buyer-complaint
 * window while matching our written agreement with artists.
 *
 * Lives outside of `admin/orders/actions.ts` because that file has a
 * `'use server'` directive — which forbids exporting anything that
 * isn't an async function. Pure constants and helpers belong here.
 */
export const PAYOUT_HOLD_DAYS = 14

export function payoutEligibleAt(shippedAt: Date | string | null): Date | null {
  if (!shippedAt) return null
  const ms = typeof shippedAt === 'string' ? Date.parse(shippedAt) : shippedAt.getTime()
  return new Date(ms + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000)
}
