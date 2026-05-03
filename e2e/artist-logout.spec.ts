import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/artist.json' })

/**
 * Same shape as the admin logout spec but for an artist account,
 * reusing the artist session captured by globalSetup.
 */
test('artist logout: signs out and clears the session', async ({ page }) => {
  await page.goto('/dashboard')

  await page.getByRole('button', { name: /^log out$/i }).click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })

  const sessionRes = await page.request.get('/api/auth/session')
  const session = await sessionRes.json()
  expect(session?.user, 'session should be empty after logout').toBeFalsy()
})
