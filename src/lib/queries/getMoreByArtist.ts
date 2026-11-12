import { getPublicArtistByHandler, type PublicArtistArtwork } from './getPublicArtistByHandler'

/**
 * "More by the artist" under a work (docs/public-redesign/artwork.md): other works from the artist's
 * own page, in the artist's order, without the one being shown. The same rows the artist page
 * renders (sale resolved, print render attached), so the cards there and here agree. Empty for an
 * unpublished artist or one with no other featured work.
 */
export async function getMoreByArtist(
  handler: string,
  excludeSlug: string,
  limit = 4,
): Promise<PublicArtistArtwork[]> {
  const artist = await getPublicArtistByHandler(handler)
  return (artist?.artworks ?? []).filter((work) => work.slug !== excludeSlug).slice(0, limit)
}
