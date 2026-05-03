import { test, expect } from '@playwright/test'

/**
 * Negative-path coverage. Each public-page server component does an
 * existence check at the request boundary and calls `notFound()` on
 * miss, which gives a clean 404 (proper status + Next's not-found.tsx
 * fallback). The print-wizard route additionally requires the
 * artwork to be print-enabled and have a price set; both also
 * resolve to a 404 when missing.
 *
 * What this catches:
 *   - A Prisma query throwing on missing data (would be a 5xx) — the
 *     class of regression we already shipped once with the
 *     printProvider schema-DB drift.
 *   - Anyone removing `notFound()` from a public page, which would
 *     silently return 200 with a "not found" client-rendered body
 *     and pollute SEO + analytics.
 *
 * Read-only by definition — these slugs deliberately don't exist.
 */
const NONSENSE_SLUG = 'this-slug-does-not-exist-e2e-x9k2'

// Title-friendly labels paired with the URL we hit. Keeps the test
// reporter readable at a glance (`404: artwork page`) while the
// failure message still includes the full path that was requested.
const routes: Array<{ label: string; path: string }> = [
  { label: 'artwork page', path: `/artworks/${NONSENSE_SLUG}` },
  { label: 'print wizard', path: `/artworks/${NONSENSE_SLUG}/print` },
  { label: 'artist profile', path: `/artists/${NONSENSE_SLUG}` },
  { label: 'exhibition', path: `/exhibitions/${NONSENSE_SLUG}/${NONSENSE_SLUG}` },
]

for (const { label, path } of routes) {
  test(`404: ${label}`, async ({ page }) => {
    const response = await page.goto(path)
    const status = response?.status() ?? 0
    expect(status, `route ${path} returned ${status}; expected 404`).toBe(404)
  })
}
