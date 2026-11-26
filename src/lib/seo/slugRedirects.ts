import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'

/**
 * Old addresses that moved (AR-193, the SlugRedirect table): an artwork's slug follows its title, an
 * exhibition's URL and an artist's handler can be edited. Without this, every rename turned the
 * links already out there (posts, pins, search results) into 404s.
 *
 * Writes happen after a rename is saved; reads only on the way to a 404, so a page that resolves
 * never pays for them. Both are best effort: a database without the table yet (schema not synced)
 * neither fails a save nor breaks a page, it only skips the redirect.
 */
export type SlugKind = 'artwork' | 'exhibition' | 'artist'

/** Remember that `oldSlug` now belongs to `targetId` (whatever its current slug). */
export async function recordSlugChange(kind: SlugKind, oldSlug: string, targetId: string) {
  if (!oldSlug) return
  try {
    await prisma.slugRedirect.upsert({
      where: { kind_oldSlug: { kind, oldSlug } },
      create: { kind, oldSlug, targetId },
      update: { targetId },
    })
  } catch (error) {
    captureError(error, {
      flow: 'content',
      stage: 'record-slug-redirect',
      level: 'warning',
      extra: { kind, oldSlug, targetId },
    })
  }
}

async function targetOf(kind: SlugKind, oldSlug: string): Promise<string | null> {
  try {
    const row = await prisma.slugRedirect.findUnique({
      where: { kind_oldSlug: { kind, oldSlug } },
      select: { targetId: true },
    })
    return row?.targetId ?? null
  } catch (error) {
    captureError(error, {
      flow: 'content',
      stage: 'read-slug-redirect',
      level: 'warning',
      extra: { kind, oldSlug },
    })
    return null
  }
}

/** The artwork's current page for an old slug, or null. Public works only (published artist). */
export async function movedArtworkPath(slug: string): Promise<string | null> {
  const id = await targetOf('artwork', slug)
  if (!id) return null
  const artwork = await prisma.artwork.findFirst({
    where: { id, user: { published: true } },
    select: { slug: true },
  })
  return artwork && artwork.slug !== slug ? `/artworks/${artwork.slug}` : null
}

/** The artist's current page for an old handler, or null. Published artists only. */
export async function movedArtistPath(handler: string): Promise<string | null> {
  const id = await targetOf('artist', handler)
  if (!id) return null
  const artist = await prisma.user.findFirst({
    where: { id, published: true },
    select: { handler: true },
  })
  return artist && artist.handler !== handler ? `/artists/${artist.handler}` : null
}

/**
 * The exhibition's current page for an address that no longer matches, or null. Two ways an
 * address goes stale: the artist's handler changed (the URL itself is unique across artists, so it
 * still names the exhibition), or the exhibition's URL changed. Published exhibitions only.
 */
export async function movedExhibitionPath(
  artistSlug: string,
  exhibitionSlug: string,
): Promise<string | null> {
  const select = { url: true, user: { select: { handler: true } } } as const
  const pathOf = (e: { url: string; user: { handler: string } }) =>
    `/exhibitions/${e.user.handler}/${e.url}`

  const sameUrl = await prisma.exhibition.findFirst({
    where: { url: exhibitionSlug, published: true },
    select,
  })
  if (sameUrl) return sameUrl.user.handler !== artistSlug ? pathOf(sameUrl) : null

  const id = await targetOf('exhibition', exhibitionSlug)
  if (!id) return null
  const moved = await prisma.exhibition.findFirst({ where: { id, published: true }, select })
  return moved ? pathOf(moved) : null
}
