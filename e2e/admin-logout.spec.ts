import { test, expect } from '@playwright/test'

// Reuse the admin session captured by globalSetup so this spec doesn't
// re-issue another login-code (the endpoint rate-limits at 5/min per IP).
test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * Admin can sign out cleanly. Starts already-logged-in via the
 * admin storageState, navigates to the dashboard, clicks Log out,
 * and verifies the session is gone.
 */
test('admin logout: signs out and clears the session', async ({ page }) => {
  await page.goto('/admin/dashboard')

  await page.getByRole('button', { name: /^log out$/i }).click()

  // The signOut callback redirects to '/'.
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
