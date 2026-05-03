import { test, expect } from '@playwright/test'

import { getArtistCredentials, signInThroughUi } from './auth-helpers'

/**
 * Artist (non-admin) can sign in and lands on the artist dashboard
 * (NOT the admin dashboard). Also confirms the artist can't access
 * /admin/dashboard directly — the route should redirect them off.
 *
 * Same DB-side caveat as the admin spec: the login code is
 * server-managed and clears itself on success.
 */
test('artist login: lands on /dashboard, no admin access', async ({ page }) => {
  await signInThroughUi(page, getArtistCredentials())

  // Artist redirect target is /dashboard (their own profile), not
  // /admin/dashboard.
  await expect(page, 'artist should land on the artist dashboard').toHaveURL(
    /\/dashboard(?!\/login)/,
  )
  await expect(page).not.toHaveURL(/\/admin\//)

  // Direct attempt to visit the admin dashboard should be bounced.
  // The admin pages have a useEffect-based guard that pushes
  // non-admins to '/' — so the URL ends up off /admin entirely.
  await page.goto('/admin/dashboard')
  await page.waitForLoadState('networkidle')
  await expect(page, 'artist should not be allowed on /admin/dashboard').not.toHaveURL(
    /\/admin\/dashboard/,
  )
})
