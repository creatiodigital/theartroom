import { test, expect } from '@playwright/test'

import { runBuyerFlow } from './buyer-flow-helpers'
import {
  deletePrintOrderByPaymentIntent,
  waitForPrintOrderByPaymentIntent,
} from './cleanup-helpers'

/**
 * Admin order lifecycle — exercise every advance step the admin can
 * take, end-to-end:
 *
 *   New → mark placed (Capture & mark placed)
 *     → mark in production
 *     → mark shipped (with tracking URL)
 *     → mark delivered
 *     → pay manually (out-of-band, sidesteps Stripe Connect transfer)
 *     → delete order
 *
 * This is a WRITE test. It creates a real PrintOrder via the buyer
 * flow, then walks it through the admin transitions. Best-effort
 * cleanup runs in `finally`.
 *
 * Pre-requisites: same as buyer-checkout.spec.ts — Stripe test-mode
 * keys + SKIP_EMAILS=true so the admin transitions don't fan out to
 * the buyer's inbox.
 */

test.use({ storageState: 'e2e/.auth/admin.json' })

test('admin order lifecycle: advance every stage and delete', async ({ page }) => {
  test.setTimeout(240_000)

  let paymentIntentId: string | null = null

  try {
    // Buyer flow first — creates the order we'll operate on.
    const result = await runBuyerFlow(page)
    paymentIntentId = result.paymentIntentId

    const order = await waitForPrintOrderByPaymentIntent(paymentIntentId)
    expect(order, 'PrintOrder should exist after buyer flow').not.toBeNull()
    if (!order) return // type-narrow

    // ── Open the admin order detail page ────────────────────────
    const detailUrl = `/admin/orders/${order.id}`
    const res = await page.goto(detailUrl)
    expect(res?.status(), 'admin order detail should respond 2xx').toBeLessThan(400)

    // ── Capture & mark placed ────────────────────────────────────
    // Detail page fires handlePlaced directly on click (no
    // confirmation modal — that lives only on the now-removed list
    // view modal). Click and wait for the next stage's CTA.
    const placeCta = page.getByRole('button', { name: /capture payment & mark placed/i })
    await expect(placeCta, 'capture & mark placed CTA should be visible').toBeVisible({
      timeout: 30_000,
    })
    await placeCta.click()
    await expect(
      page.getByRole('button', { name: /mark in production/i }),
      'after place: mark in production CTA should appear',
    ).toBeVisible({ timeout: 30_000 })

    // ── Mark in production ──────────────────────────────────────
    await page.getByRole('button', { name: /mark in production/i }).click()
    await expect(
      page.getByRole('button', { name: /mark shipped/i }),
      'after production: mark shipped CTA should appear',
    ).toBeVisible({ timeout: 30_000 })

    // ── Mark shipped (with tracking URL) ────────────────────────
    await page.getByRole('button', { name: /mark shipped/i }).click()
    await page.getByLabel(/tracking url/i).fill('https://tracking.example.com/e2e-test')
    await page.getByRole('button', { name: /^mark shipped$/i }).click()
    await expect(
      page.getByRole('button', { name: /mark delivered/i }),
      'after shipped: mark delivered CTA should appear',
    ).toBeVisible({ timeout: 30_000 })

    // ── Mark delivered ──────────────────────────────────────────
    await page.getByRole('button', { name: /mark delivered/i }).click()
    await expect(
      page.getByRole('button', { name: /pay manually/i }),
      'after delivered: pay-the-artist box (with Pay manually) should appear',
    ).toBeVisible({ timeout: 30_000 })

    // ── Pay manually (sidesteps Stripe Connect) ─────────────────
    await page.getByRole('button', { name: /pay manually/i }).click()
    await page.getByLabel(/^method/i).fill('SEPA')
    // The "Mark paid" button label includes the artist amount.
    const markPaidBtn = page.getByRole('button', { name: /^mark paid \(/i })
    await expect(markPaidBtn).toBeEnabled({ timeout: 5_000 })
    await markPaidBtn.click()
    await expect(
      page.getByText(/Artist paid/i).first(),
      'after paying artist: Artist paid badge should appear in the trail',
    ).toBeVisible({ timeout: 30_000 })

    // ── Delete order ─────────────────────────────────────────────
    await page.getByRole('button', { name: /^delete order$/i }).click()
    await page.getByRole('button', { name: /yes, delete permanently/i }).click()
    // Should redirect back to /admin/orders
    await page.waitForURL('**/admin/orders', { timeout: 30_000 })
  } finally {
    if (paymentIntentId) {
      await deletePrintOrderByPaymentIntent(paymentIntentId)
    }
  }
})
