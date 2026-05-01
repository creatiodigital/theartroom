/**
 * The "safe window" we recommend waiting after delivery before paying
 * the artist. Covers the typical buyer-complaint window (lost-in-mail
 * claims, condition disputes) — paying before this passes is allowed,
 * but if the buyer disputes after the artist has been paid, recovering
 * the artist's share is the gallery's problem.
 *
 * NOT a hard gate any more. Admin decides when to release. The UI
 * surfaces this number as a counter / risk hint only.
 */
export const PAYOUT_SAFE_WINDOW_DAYS = 14

/**
 * Whole days that have elapsed since `shippedAt` (which despite the
 * column name is actually stamped when the admin marks the order
 * delivered). Returns null if the order isn't delivered yet.
 */
export function daysSinceDelivered(shippedAt: Date | string | null): number | null {
  if (!shippedAt) return null
  const ms = typeof shippedAt === 'string' ? Date.parse(shippedAt) : shippedAt.getTime()
  const diffMs = Date.now() - ms
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}
