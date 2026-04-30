import { test, expect, type Page } from '@playwright/test'

import { fixtures, routes } from './fixtures'

/**
 * Price-consistency end-to-end.
 *
 * Drives the wizard → checkout flow and asserts the "Total (before
 * taxes)" displayed at the wizard step matches the same total shown
 * on the checkout (shipping address) step. Catches drift between the
 * wizard's live-quote pipeline and the checkout's recomputed total.
 *
 * Read-only — does not submit any form to the server.
 */

/** Read the price text out of the right-hand summary "Total" row.
 *  Returns the cents-equivalent integer for stable comparison. */
async function readTotalCents(page: Page): Promise<number> {
  // The summary panel renders both the wizard step and the checkout
  // step's totals using the shared OrderSummary, with the row label
  // starting "Total" — matches "Total" and "Total (before taxes)" both.
  const totalRowLocator = page.getByText(/^Total\b/).first()
  await expect(totalRowLocator, 'summary should show a Total row').toBeVisible({
    timeout: 30_000,
  })
  // The live quote can leave the row showing "Calculating…" briefly
  // after the CTA enables — wait for an actual € amount to render
  // before parsing.
  const rowEl = totalRowLocator.locator('..')
  await expect(rowEl, 'Total row should display a € amount').toContainText(/€\s*[\d.,]+/, {
    timeout: 30_000,
  })
  const rowText = await rowEl.innerText()
  const match = rowText.match(/€\s*([\d.,]+)/)
  if (!match) throw new Error(`Could not extract price from total row: "${rowText}"`)
  // €179,56 (some locales) or €179.56 — normalise to a number then to cents.
  const normalised = match[1].replace(/\./g, '').replace(',', '.')
  let value = Number(normalised)
  if (!Number.isFinite(value) || value < 1) {
    value = Number(match[1].replace(',', '.'))
  }
  return Math.round(value * 100)
}

test('wizard total matches checkout total for the same selection', async ({ page }) => {
  test.setTimeout(60_000)

  const slug = fixtures.artworkSlug

  // ── Step 1: open wizard, pick a supported destination ────
  const wizardResponse = await page.goto(routes.printWizard(slug))
  expect(wizardResponse?.status(), 'print wizard should respond 2xx').toBeLessThan(400)

  // The Destination collapsible auto-opens when no country is
  // picked yet (StepsPanel.tsx). The dropdown is the only button
  // matching /choose a country/i.
  await page.getByRole('button', { name: /choose a country/i }).click()
  // Belgium — EU VAT rate, stable choice.
  await page.getByRole('option', { name: /belgium/i }).click()

  // Wait for the live quote to land — the wizard's CTA flips from
  // disabled to enabled once the quote returns.
  const wizardCta = page.getByRole('button', { name: /add shipping address/i })
  await expect(wizardCta, 'wizard CTA should be enabled once the quote lands').toBeEnabled({
    timeout: 30_000,
  })

  const wizardTotalCents = await readTotalCents(page)
  expect(wizardTotalCents, 'wizard total should be a positive amount').toBeGreaterThan(0)

  // ── Step 2: advance to checkout, read the same total ─────
  await wizardCta.click()
  await page.waitForURL(`**/artworks/${slug}/print/checkout?**`, { timeout: 15_000 })

  const checkoutCta = page.getByRole('button', { name: /continue to payment/i })
  await expect(checkoutCta, 'checkout CTA should be present').toBeVisible({ timeout: 15_000 })

  const checkoutTotalCents = await readTotalCents(page)

  // ── Assertion: same selection ⇒ same total ──────────────
  // Both pages display "Total (before taxes)" — the actual subtotal
  // that drives the buyer's expectation. Tolerate ±1 cent for
  // rounding pathology.
  expect(
    Math.abs(wizardTotalCents - checkoutTotalCents),
    `wizard total (${wizardTotalCents}) and checkout total (${checkoutTotalCents}) should match`,
  ).toBeLessThanOrEqual(1)
})
