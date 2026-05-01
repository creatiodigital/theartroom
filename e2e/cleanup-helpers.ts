import prisma from '@/lib/prisma'

/**
 * Write-helpers used ONLY by full-flow e2e tests that exercise the
 * buyer + admin pipelines end-to-end. Keep them out of `db-helpers`
 * to preserve that module's read-only contract.
 *
 * Every helper here is idempotent and best-effort — partial failures
 * are logged but never thrown, so test cleanup can run in `finally`
 * blocks without masking the real assertion failure.
 */

const POLL_INTERVAL_MS = 500
const POLL_TIMEOUT_MS = 15_000

/** Poll until a PrintOrder exists for the given paymentIntentId, or timeout. */
export async function waitForPrintOrderByPaymentIntent(
  paymentIntentId: string,
): Promise<{ id: string; paymentIntentId: string } | null> {
  const start = Date.now()
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const order = await prisma.printOrder.findUnique({
      where: { paymentIntentId },
      select: { id: true, paymentIntentId: true },
    })
    if (order) return order
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  return null
}

/**
 * Best-effort cleanup. Cascades remove PrintOrderEvent rows via the
 * `onDelete: Cascade` on the relation. If the order doesn't exist
 * (e.g., webhook never fired), this is a no-op.
 */
export async function deletePrintOrderByPaymentIntent(paymentIntentId: string): Promise<void> {
  try {
    await prisma.printOrder.deleteMany({ where: { paymentIntentId } })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[e2e cleanup] delete by paymentIntentId=${paymentIntentId} failed:`,
      err instanceof Error ? err.message : err,
    )
  }
}

/** Same as above but by orderId, for tests that already have it. */
export async function deletePrintOrderById(orderId: string): Promise<void> {
  try {
    await prisma.printOrder.deleteMany({ where: { id: orderId } })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[e2e cleanup] delete by id=${orderId} failed:`,
      err instanceof Error ? err.message : err,
    )
  }
}
