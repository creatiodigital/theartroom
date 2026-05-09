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

  // Poll the session endpoint — the cookie clear and the redirect can
  // race, so the first request after waitForURL may still carry the
  // expiring cookie. Retry briefly until the server confirms no user.
  await expect
    .poll(
      async () => {
        const res = await page.request.get('/api/auth/session')
        const data = await res.json()
        return data?.user
      },
      { message: 'session should be empty after logout', timeout: 5_000 },
    )
    .toBeFalsy()
})
