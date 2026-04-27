import { test, expect } from '@playwright/test'

import { routes } from './fixtures'

/**
 * Print wizard — the most business-critical surface. Touches the
 * catalog builder, the per-artwork restriction filter, the provider
 * routing logic, and (once a destination is picked) the live quote
 * pipeline.
 *
 * This baseline test is intentionally minimal: confirm the route
 * resolves, the wizard shell hydrates, and the catalog produced at
 * least the Paper and Size dimensions for this artwork. The full
 * "drive the wizard to a price + Stripe payment" flow lives in a
 * separate spec because it mutates the DB.
 *
 * Read-only.
 */
test('print wizard: paper + size dimensions visible', async ({ page }) => {
  const response = await page.goto(routes.printWizard())
  expect(response?.status(), 'print wizard should respond 2xx').toBeLessThan(400)

  // Wizard requires a destination before quoting prices, so we don't
  // assert on a price here. We assert on the catalog shell — the
  // CollapsibleSection titles for Paper and Size are rendered up
  // front by the wizard regardless of country selection. If the
  // catalog builder fails (all-vetoed, missing provider, bad
  // restrictions JSON, etc.), neither will appear.
  // Provider-agnostic match: Prodigi labels the section "Paper" /
  // "Size", TPS labels them "Paper" / "Print size". Both are rendered
  // as <button>s by CollapsibleSection.
  await expect(
    page.getByRole('button', { name: /paper/i }).first(),
    'wizard should expose a Paper dimension',
  ).toBeVisible({ timeout: 30_000 })

  await expect(
    page.getByRole('button', { name: /size/i }).first(),
    'wizard should expose a Size dimension',
  ).toBeVisible({ timeout: 30_000 })
})
