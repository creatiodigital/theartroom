import type { TArtwork } from '@/types/artwork'

import type { Artwork, Artist } from '@/components/artwork/detail/ArtworkDetailBody'

/**
 * Map a scene artwork (Redux `TArtwork`) into the body's shapes for an INSTANT first
 * paint. Fields the scene does not hold (description, printEnabled/printPriceCents, the full
 * artist record) are filled by the by-slug fetch. The work's shape (originalWidth/Height) the
 * scene does hold, and it goes in here: the body picks its portrait layout from it, so without
 * it the first paint guessed a square and the image grew when the fetch arrived.
 */
export function mapReduxArtwork(a: TArtwork): { artwork: Artwork; artist: Artist } {
  return {
    artwork: {
      id: a.id,
      slug: a.slug ?? '',
      name: a.name,
      title: a.artworkTitle ?? null,
      author: a.author ?? null,
      year: a.artworkYear ?? null,
      technique: a.technique ?? null,
      dimensions: a.artworkDimensions ?? null,
      imageUrl: a.imageUrl ?? null,
      originalWidth: a.originalWidth ?? null,
      originalHeight: a.originalHeight ?? null,
    },
    artist: { id: '', name: '', lastName: '', handler: '' },
  }
}
