import prisma from '@/lib/prisma'

/**
 * Build a publishable snapshot of an exhibition's current state.
 * Captures all exhibition settings + artwork positions + artwork metadata.
 *
 * Uses an "omit" approach: we destructure out internal/system fields and
 * spread everything else. This ensures new fields are automatically included
 * without manual updates to this file.
 */
export async function buildExhibitionSnapshot(exhibitionId: string) {
  const exhibition = await prisma.exhibition.findUnique({
    where: { id: exhibitionId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          lastName: true,
          handler: true,
          biography: true,
        },
      },
      exhibitionArtworks: {
        include: {
          artwork: {
            select: {
              id: true,
              name: true,
              title: true,
              author: true,
              year: true,
              technique: true,
              dimensions: true,
              imageUrl: true,
              artworkType: true,
              textContent: true,
              hiddenFromExhibition: true,
            },
          },
        },
      },
    },
  })

  if (!exhibition) {
    throw new Error(`Exhibition ${exhibitionId} not found`)
  }

  // Omit internal/system fields — everything else is part of the snapshot
  const {
    id: _id,
    userId: _userId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    published: _published,
    previewEnabled: _previewEnabled,
    previewToken: _previewToken,
    exhibitionArtworks,
    ...exhibitionSnapshot
  } = exhibition

  return {
    exhibition: exhibitionSnapshot,
    artworks: exhibitionArtworks.map((ea) => {
      // Omit Prisma relation/system fields — keep all curatorial data
      const {
        exhibitionId: _exhId,
        createdAt: _eaCreatedAt,
        updatedAt: _eaUpdatedAt,
        ...positionSnapshot
      } = ea

      return {
        ...positionSnapshot,
        // Apply defaults for fields that may be null in the DB
        videoPlayMode: ea.videoPlayMode ?? 'proximity',
        videoLoop: ea.videoLoop ?? true,
        videoVolume: ea.videoVolume ?? 1.0,
        videoProximityDistance: ea.videoProximityDistance ?? 3,
      }
    }),
  }
}
