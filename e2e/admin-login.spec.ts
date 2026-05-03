import { test, expect } from '@playwright/test'

import { getAdminCredentials, signInThroughUi } from './auth-helpers'

/**
 * Admin can sign in via email + password + 6-digit code, and lands
 * on the admin dashboard.
 *
 * Reads the freshly-issued login code straight from the DB so we
 * don't need to scrape an inbox — see auth-helpers for details.
 *
 * Read-only flow on the DB except for the `loginCode` column which
 * is server-managed (issued + cleared by the auth flow itself).
 */
test('admin login: lands on /admin/dashboard', async ({ page }) => {
  await signInThroughUi(page, getAdminCredentials())

  // Admins are redirected to /admin/dashboard by the login form;
  // artists go to /dashboard. Asserting the URL is the cleanest
  // signal that the role-aware routing worked.
  await expect(page, 'admin should land on the admin dashboard').toHaveURL(/\/admin\/dashboard/)
})
