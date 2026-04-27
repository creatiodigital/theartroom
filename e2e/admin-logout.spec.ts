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

  // No session cookie / no user — confirmed via NextAuth's session
  // endpoint, which is the source of truth.
  const sessionRes = await page.request.get('/api/auth/session')
  const session = await sessionRes.json()
  expect(session?.user, 'session should be empty after logout').toBeFalsy()
})
