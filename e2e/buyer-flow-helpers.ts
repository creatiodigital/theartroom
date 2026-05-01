import { expect, type Page } from '@playwright/test'

import { fixtures, routes } from './fixtures'
import { pickCheckoutCountry } from './wizard-helpers'

/**
 * Drives the full buyer-side print flow with the default wizard
 * configuration: artwork page → wizard → checkout → Stripe payment
 * → confirmation. Returns the paymentIntentId so the caller can
 * verify state in the DB / clean up afterward.
 *
 * Used by full-flow e2e tests (buyer-checkout.spec.ts,
 * admin-order-lifecycle.spec.ts). Relies on:
 *   - SKIP_EMAILS=true in the dev server's env to prevent Resend
 *     from blasting real emails during the run.
 *   - Stripe test-mode publishable key (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).
 *
 * Cleanup is the caller's responsibility (see cleanup-helpers.ts).
 */

const TEST_CARD = {
  number: '4242 4242 4242 4242',
  expiry: '1234',
  cvc: '123',
  zip: '28001',
}

export interface BuyerFlowResult {
  paymentIntentId: string
  artworkSlug: string
}

export async function runBuyerFlow(page: Page): Promise<BuyerFlowResult> {
  const slug = fixtures.artworkSlug

  // ── Wizard ─────────────────────────────────────────────────────
  const wizardResponse = await page.goto(routes.printWizard(slug))
  expect(wizardResponse?.status(), 'wizard should respond 2xx').toBeLessThan(400)

  const wizardCta = page.getByRole('button', { name: /add shipping address/i })
  await expect(wizardCta, 'wizard CTA should be enabled with default config').toBeEnabled({
    timeout: 30_000,
  })
  await wizardCta.click()
  await page.waitForURL(`**/artworks/${slug}/print/checkout?**`, { timeout: 15_000 })

  // ── Checkout: shipping form ───────────────────────────────────
  await pickCheckoutCountry(page, 'belgium')
  await page.getByLabel(/full name/i).fill('Test Buyer')
  await page.getByLabel(/email/i).fill('e2e+buyer@theartroom.gallery')
  await page.getByLabel(/phone \(for carrier\)/i).fill('612345678')
  await page.getByLabel(/^address$/i).fill('123 Rue de la Loi')
  await page.getByLabel(/^city$/i).fill('Brussels')
  await page.getByLabel(/^postal code$/i).fill('1000')

  const continueCta = page.getByRole('button', { name: /continue to payment/i })
  await expect(continueCta, 'continue CTA should enable once form is valid').toBeEnabled({
    timeout: 15_000,
  })
  await continueCta.click()
  await page.waitForURL(`**/artworks/${slug}/print/payment?**`, { timeout: 15_000 })

  // ── Payment: Stripe PaymentElement ────────────────────────────
  // PaymentElement renders fields inside Stripe-hosted iframes.
  // Identify by the iframe's title (Stripe sets a stable substring).
  const stripeFrame = page.frameLocator('iframe[title*="Secure payment input frame"]').first()

  const cardNumberField = stripeFrame.getByLabel(/card number/i)
  await expect(cardNumberField, 'card number field should be visible').toBeVisible({
    timeout: 30_000,
  })
  await cardNumberField.fill(TEST_CARD.number)

  await stripeFrame.getByLabel(/expir/i).fill(TEST_CARD.expiry)
  await stripeFrame.getByLabel(/security code|cvc/i).fill(TEST_CARD.cvc)

  // Stripe asks for ZIP for some card brands / regions. The field
  // sometimes isn't rendered — fill if present, ignore otherwise.
  const zipField = stripeFrame.getByLabel(/zip|postal/i)
  if (await zipField.count()) {
    await zipField.first().fill(TEST_CARD.zip)
  }

  const payCta = page.getByRole('button', { name: /^pay\s+€/i })
  await expect(payCta, 'pay CTA should be on the page').toBeVisible({ timeout: 15_000 })
  await payCta.click()

  // ── Confirmation ──────────────────────────────────────────────
  await page.waitForURL(`**/artworks/${slug}/print/confirmation?**`, { timeout: 60_000 })

  const url = new URL(page.url())
  const paymentIntentId = url.searchParams.get('payment_intent')
  if (!paymentIntentId) {
    throw new Error('Confirmation URL missing payment_intent — Stripe redirect changed?')
  }

  return { paymentIntentId, artworkSlug: slug }
}
