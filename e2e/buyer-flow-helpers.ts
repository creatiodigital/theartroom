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

  // Capture browser-side signals so when the Stripe redirect hangs
  // we can tell whether confirmPayment errored client-side or Stripe
  // rejected something at the API. Surfaced in the timeout error.
  const consoleErrors: string[] = []
  const stripeNetworkErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))
  page.on('response', (res) => {
    const url = res.url()
    if (!url.includes('stripe.com')) return
    const status = res.status()
    if (status >= 400) stripeNetworkErrors.push(`${status} ${url}`)
  })

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
  // example.com is IANA-reserved for documentation — guaranteed to
  // bounce, so even without SKIP_EMAILS=true a stray test won't
  // deliver anything anywhere real.
  await page.getByLabel(/email/i).fill('e2e+buyer@example.com')
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

  // With `automatic_payment_methods: { enabled: true }` Stripe shows
  // multiple methods as tabs (Card + bank-redirect rails depending
  // on the buyer's country). The default tab varies, so explicitly
  // pick "Card" before filling card fields. If only Card is offered,
  // there's no tablist — skip silently.
  const cardTab = stripeFrame.getByRole('tab', { name: /^card$/i })
  if (await cardTab.count()) {
    await cardTab.first().click()
  }

  const cardNumberField = stripeFrame.getByLabel(/card number/i)
  await expect(cardNumberField, 'card number field should be visible').toBeVisible({
    timeout: 30_000,
  })
  await cardNumberField.fill(TEST_CARD.number)

  // `getByRole('textbox')` filters to actual form controls — Stripe
  // ships SVG icons with the same accessible names ("Security code",
  // "ZIP code") which would otherwise confuse strict-mode locators.
  await stripeFrame.getByRole('textbox', { name: /expir/i }).fill(TEST_CARD.expiry)
  await stripeFrame.getByRole('textbox', { name: /security code|cvc/i }).fill(TEST_CARD.cvc)

  // ZIP is rendered conditionally (US-style postal field for some
  // card brands / regions). Skip if absent.
  const zipField = stripeFrame.getByRole('textbox', { name: /zip|postal/i })
  if (await zipField.count()) {
    await zipField.first().fill(TEST_CARD.zip)
  }

  const payCta = page.getByRole('button', { name: /^pay\s+€/i })
  await expect(payCta, 'pay CTA should be on the page').toBeVisible({ timeout: 15_000 })
  await payCta.click()

  // ── Confirmation ──────────────────────────────────────────────
  try {
    await page.waitForURL(`**/artworks/${slug}/print/confirmation?**`, { timeout: 60_000 })
  } catch (err) {
    // Stripe didn't redirect to the confirmation URL within the
    // timeout. Pull together every signal we've been collecting so
    // the failure is actionable instead of just "timed out".
    const visibleError = await page
      .locator('[class*="paymentError" i], [role="alert"], .error')
      .first()
      .textContent({ timeout: 1000 })
      .catch(() => null)
    const debug = [
      `current url: ${page.url()}`,
      visibleError ? `visible error on page: ${visibleError.trim()}` : 'no visible error span',
      stripeNetworkErrors.length
        ? `stripe.com 4xx/5xx: ${stripeNetworkErrors.join(' | ')}`
        : 'no stripe.com 4xx/5xx',
      consoleErrors.length
        ? `browser console errors:\n  - ${consoleErrors.slice(-5).join('\n  - ')}`
        : 'no browser console errors',
    ].join('\n')
    throw new Error(
      `Stripe redirect to /confirmation never fired.\n${debug}\n\nOriginal: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const url = new URL(page.url())
  const paymentIntentId = url.searchParams.get('payment_intent')
  if (!paymentIntentId) {
    throw new Error('Confirmation URL missing payment_intent — Stripe redirect changed?')
  }

  return { paymentIntentId, artworkSlug: slug }
}
