import { formatOrderRef } from '@/lib/orders/orderRef'

/**
 * Why the admin ledger's Release must refuse this copy, or null when it may go
 * back on sale. The one rule behind `releaseEditionNumberAdmin` (the server
 * action), kept here so e2e can check it without an admin session: the ledger
 * no longer shows Release on gift rows (questions.md Q16), so the refusal is
 * tested at this level instead of through the button.
 */
export function editionReleaseRefusal(row: {
  state: string
  /** The order this copy is bound to (single-print or cart path), if any. */
  boundOrderId: string | null
  offPlatformOrderId: string | null
}): string | null {
  if (row.state === 'available') {
    return 'This number is already available — nothing to release.'
  }
  if (row.boundOrderId) {
    return `This copy is attached to order ${formatOrderRef(row.boundOrderId)}. Cancel or refund that order instead.`
  }
  if (row.offPlatformOrderId) {
    return 'This copy belongs to a gift / artist-copy order. Cancel it from the Gift orders page instead — that releases the number.'
  }
  return null
}
