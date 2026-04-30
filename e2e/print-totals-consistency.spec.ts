import { test, expect, type Page } from '@playwright/test'

import { fixtures, routes } from './fixtures'
import { pickCheckoutCountry } from './wizard-helpers'

/**
 * Artwork-line consistency between wizard and checkout.
 *
 * Country lives on the checkout step now, so the wizard shows only the
 * country-independent "Artwork" line (artist + gallery markup +
 * production cost). Picking a country on checkout adds Shipping + VAT
 * but the Artwork line itself must stay identical for the same
 * selection. Catches drift between the wizard's live-quote pipeline
 * and the checkout's recomputed quote.
 *
 * Read-only — does not submit any form.
 */

/** Read the "Artwork" row's € amount as integer cents. */
async function readArtworkCents(page: Page): Promise<number> {
  const row = page
    .locator('div')
    .filter({
      has: page.getByRole('term').filter({ hasText: /^Artwork$/ }),
    })
    .first()
  // OrderSummary on checkout uses <span> instead of <dt>/<dd>; match
  // both shapes by looking at any element whose direct text is "Artwork".
  const fallback = page.getByText(/^Artwork$/).first()
  const target = (await row.count()) > 0 ? row : fallback.locator('..')
  await expect(target, 'summary should show an Artwork row').toBeVisible({ timeout: 30_000 })
  await expect(target, 'Artwork row should display a € amount').toContainText(/€\s*[\d.,]+/, {
    timeout: 30_000,
  })
  const rowText = await target.innerText()
  const match = rowText.match(/€\s*([\d.,]+)/)
  if (!match) throw new Error(`Could not extract price from Artwork row: "${rowText}"`)
  // €179,56 (some locales) or €179.56 — normalise to a number then cents.
  const normalised = match[1].replace(/\./g, '').replace(',', '.')
  let value = Number(normalised)
  if (!Number.isFinite(value) || value < 1) {
    value = Number(match[1].replace(',', '.'))
  }
  return Math.round(value * 100)
}

test('wizard and checkout show the same Artwork line for the same selection', async ({ page }) => {
  test.setTimeout(60_000)

  const slug = fixtures.artworkSlug

  // ── Step 1: open wizard, read the artwork-line preview ────
  const wizardResponse = await page.goto(routes.printWizard(slug))
  expect(wizardResponse?.status(), 'print wizard should respond 2xx').toBeLessThan(400)

  const wizardCta = page.getByRole('button', { name: /add shipping address/i })
  await expect(wizardCta, 'wizard CTA should be enabled with default config').toBeEnabled({
    timeout: 30_000,
  })

  const wizardArtworkCents = await readArtworkCents(page)
  expect(wizardArtworkCents, 'wizard artwork line should be positive').toBeGreaterThan(0)

  // ── Step 2: advance to checkout, pick country, read again ────
  await wizardCta.click()
  await page.waitForURL(`**/artworks/${slug}/print/checkout?**`, { timeout: 15_000 })

  // Country picker is the new first field on the address form.
  await pickCheckoutCountry(page, 'belgium')

  const checkoutCta = page.getByRole('button', { name: /continue to payment/i })
  await expect(checkoutCta, 'checkout CTA should be present').toBeVisible({ timeout: 15_000 })

  const checkoutArtworkCents = await readArtworkCents(page)

  // ── Assertion: artwork line is country-independent ──────
  // Tolerate ±1 cent for rounding pathology.
  expect(
    Math.abs(wizardArtworkCents - checkoutArtworkCents),
    `wizard artwork (${wizardArtworkCents}) and checkout artwork (${checkoutArtworkCents}) should match`,
  ).toBeLessThanOrEqual(1)
})
