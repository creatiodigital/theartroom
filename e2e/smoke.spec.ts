import { test, expect } from '@playwright/test'

/**
 * Smoke test — confirms Playwright is wired up correctly and the
 * dev server responds. Replace / extend once we've decided which
 * flows to cover.
 */
test('home: returns 200', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBeLessThan(400)
})
