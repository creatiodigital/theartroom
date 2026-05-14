import { test, expect } from '@playwright/test'

import { fixtures, routes } from './fixtures'

/**
 * Public artwork page — the discovery → conversion entry point.
 *
 * If this page breaks, no buyer ever reaches the print wizard. We
 * assert on the bare minimum that proves the route resolves, the
 * artwork data hydrates, and at least one conversion CTA renders
 * (Order Print when the artwork is print-enabled, Inquire as the
 * fallback). Both invisible would mean the page has no path forward.
 *
 * Read-only: just navigates and reads. No form submission.
 */
test('artwork page: renders + has CTA', async ({ page }) => {
  const response = await page.goto(routes.artwork(fixtures.artworkSlug))
  expect(response?.status(), 'artwork page should respond 2xx').toBeLessThan(400)

  // Image hydrated — best signal that the Prisma fetch + R2/CDN
  // pipeline both worked end to end.
  const artworkImage = page.locator('img').first()
  await expect(artworkImage).toBeVisible()
  expect(await artworkImage.getAttribute('src'), 'artwork image should have a src').toBeTruthy()

  // Conversion CTAs are <button> elements (Button component) — not
  // anchors — so we match by accessible name. Either label is fine
  // depending on whether the artwork is print-enabled. Both missing
  // is the regression we're catching.
  const buyPrintable = page.getByRole('button', { name: /order print/i })
  const inquire = page.getByRole('button', { name: /inquire/i })

  const buyVisible = await buyPrintable.isVisible().catch(() => false)
  const inquireVisible = await inquire.isVisible().catch(() => false)

  expect(
    buyVisible || inquireVisible,
    'artwork page must surface at least one conversion CTA (Order Print or Inquire)',
  ).toBe(true)
})
