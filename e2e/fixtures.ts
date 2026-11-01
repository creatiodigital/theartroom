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
  // The Beauty of Permanence (a published dev copy) since 2026-11-01: `landscapes` was deleted.
  exhibitionSlug: process.env.E2E_EXHIBITION_SLUG ?? 'the-beauty-of-permanence',
  artworkSlug: process.env.E2E_ARTWORK_SLUG ?? 'landscape-and-river-52416',
  // A work the fixture exhibition hangs (its grid shows it): Paseos en la arena.
  exhibitionArtworkSlug: process.env.E2E_EXHIBITION_ARTWORK_SLUG ?? 'paseos-en-la-arena-93927',
} as const

export const routes = {
  artistProfile: () => `/artists/${fixtures.artistSlug}`,
  exhibition: () => `/exhibitions/${fixtures.artistSlug}/${fixtures.exhibitionSlug}`,
  artwork: (slug: string = fixtures.artworkSlug) => `/artworks/${slug}`,
  printWizard: (slug: string = fixtures.artworkSlug) => `/artworks/${slug}/print`,
}
