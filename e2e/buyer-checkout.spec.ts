import { test, expect } from '@playwright/test'

import { runBuyerFlow } from './buyer-flow-helpers'
import {
  deletePrintOrderByPaymentIntent,
  waitForPrintOrderByPaymentIntent,
} from './cleanup-helpers'

/**
 * Buyer happy path — full flow from artwork → wizard → checkout →
 * Stripe (test mode) → confirmation modal.
 *
 * This is a WRITE test: it creates a real PrintOrder row, fires a
 * real (test-mode) Stripe PaymentIntent, and exercises the
 * order-creation webhook. Cleanup deletes the row in `finally` so
 * the dev DB doesn't accumulate fixtures.
 *
 * Pre-requisites for the dev server:
 *   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY set to a test-mode key
 *   - STRIPE_SECRET_KEY set to a test-mode key
 *   - SKIP_EMAILS=true (otherwise Resend will get pinged with the
 *     buyer + admin order-placed emails)
 *
 * If the order does not appear in the DB within the cleanup poll
 * window, the Stripe webhook → createPrintOrderFromPaymentIntent
 * pipeline didn't fire — usually because the local Stripe CLI
 * webhook listener isn't running.
 */

test.skip('buyer happy path: wizard → checkout → pay → confirmation', async ({ page }) => {
  test.setTimeout(180_000)

  let paymentIntentId: string | null = null

  try {
    const result = await runBuyerFlow(page)
    paymentIntentId = result.paymentIntentId

    await expect(
      page.getByText(/Thank you — your order is confirmed\./i),
      'confirmation page should show the success headline',
    ).toBeVisible({ timeout: 30_000 })

    // Webhook may take a moment after the redirect; assert the row
    // actually persisted before the test passes.
    const order = await waitForPrintOrderByPaymentIntent(paymentIntentId)
    expect(order, 'PrintOrder row should be created by the Stripe webhook').not.toBeNull()
  } finally {
    if (paymentIntentId) {
      await deletePrintOrderByPaymentIntent(paymentIntentId)
    }
  }
})
