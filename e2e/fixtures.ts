/**
 * Shared, read-only fixtures for the e2e suite.
 *
 * These are stable rows in the dev / staging DB that the team has
 * agreed not to delete. The tests treat them as read-only — never
 * mutate, never delete. If any of these slugs go away in dev,
 * update them here and the whole suite picks up the change.
 *
 * Slugs are passed via env vars too so a contributor can override
 * any of them locally without touching the file:
 *
 *   E2E_ARTIST_SLUG=jane pnpm test:e2e
 */
export const fixtures = {
  artistSlug: process.env.E2E_ARTIST_SLUG ?? 'john-doe',
  exhibitionSlug: process.env.E2E_EXHIBITION_SLUG ?? 'landscapes',
  artworkSlug: process.env.E2E_ARTWORK_SLUG ?? 'landscape-and-river-52416',
} as const

export const routes = {
  artistProfile: () => `/artists/${fixtures.artistSlug}`,
  exhibition: () => `/exhibitions/${fixtures.artistSlug}/${fixtures.exhibitionSlug}`,
  artwork: () => `/artworks/${fixtures.artworkSlug}`,
  printWizard: () => `/artworks/${fixtures.artworkSlug}/print`,
}
