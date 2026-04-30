import { test, expect } from '@playwright/test'

import { fixtures, routes } from './fixtures'

/**
 * Print wizard — the most business-critical surface. Touches the
 * catalog builder, the per-artwork restriction filter, and (once a
 * destination is picked) the live quote pipeline.
 *
 * The baseline assertion is intentionally minimal: route resolves,
 * wizard shell hydrates, and the catalog produces at least the Print
 * and Print size sections for this artwork. The full "drive the wizard
 * to a price + Stripe payment" flow lives in print-totals-consistency.spec.ts.
 *
 * Read-only.
 */
test('print wizard: print + size sections visible', async ({ page }) => {
  const response = await page.goto(routes.printWizard(fixtures.artworkSlug))
  expect(response?.status(), 'print wizard should respond 2xx').toBeLessThan(400)

  // The wizard hides every option section until a destination is
  // chosen — pick one so the catalog shell renders.
  await page.getByRole('button', { name: /choose a country/i }).click()
  await page.getByRole('option', { name: /belgium/i }).click()

  // TPS bundles printType+paper into a single "Print" section and
  // size+border into "Print size". Section titles target the header
  // buttons rendered by CollapsibleSection.
  await expect(
    page.getByRole('button', { name: /^Print$/ }).first(),
    'wizard should expose a Print section (printType + paper)',
  ).toBeVisible({ timeout: 30_000 })

  await expect(
    page.getByRole('button', { name: /^Print size$/ }).first(),
    'wizard should expose a Print size section',
  ).toBeVisible({ timeout: 30_000 })
})
