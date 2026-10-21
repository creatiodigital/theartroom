import { isBakedSpace } from '@/lib/bake/bakedSpaces'
import { fingerprintRoom } from '@/lib/bake/loadBakeFingerprint'
import { bakeGateError } from '@/lib/bake/publishGate'
import { toPlacedRows } from '@/lib/exhibitionArtworkMapper'
import prisma from '@/lib/prisma'

/**
 * Build a publishable snapshot of an exhibition's current state.
 * Captures all exhibition settings + artwork positions + artwork metadata.
 *
 * Uses an "omit" approach: we destructure out internal/system fields and
 * spread everything else. This ensures new fields are automatically included
 * without manual updates to this file. That includes the draft `bake` — but in a
 * baked space only a bake that passes the publish gate (see freezeExhibition).
 */
export async function buildExhibitionSnapshot(exhibitionId: string) {
  return (await freezeExhibition(exhibitionId)).snapshot
}

/**
 * Freezes the exhibition (buildExhibitionSnapshot's snapshot) and judges its draft bake
 * from the same read. In a baked space (AR-161) a bake made for another state of the room,
 * or one no admin reviewed, never enters a snapshot: the frozen room gets `bake: null`, so
 * whoever opens it sees today's look, never that bake. `bakeRefusal` says why (null when
 * the bake passes or the space isn't baked), so a publish can refuse instead.
 */
export async function freezeExhibition(exhibitionId: string) {
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
      // Placed rows only. The snapshot's one job is freezing the 3D scene —
      // the public grid reads live membership and never looks in here.
      exhibitionArtworks: {
        where: { wallId: { not: null } },
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

  // The rows read above are exactly what loadBakeFingerprint fingerprints.
  const bakeRefusal = isBakedSpace(exhibition.spaceId)
    ? bakeGateError(exhibition.bake, fingerprintRoom(exhibition, exhibition.exhibitionArtworks))
    : null

  // Omit internal/system fields — everything else is part of the snapshot
  const {
    id: _id,
    userId: _userId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    published: _published,
    previewEnabled: _previewEnabled,
    previewToken: _previewToken,
    // A snapshot must not nest the previous one.
    publishedSnapshot: _publishedSnapshot,
    exhibitionArtworks,
    ...exhibitionSnapshot
  } = exhibition

  const snapshot = {
    exhibition: { ...exhibitionSnapshot, bake: bakeRefusal ? null : exhibitionSnapshot.bake },
    artworks: toPlacedRows(exhibitionArtworks).map((ea) => {
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

  return { snapshot, bakeRefusal }
}

export type ExhibitionSnapshot = Awaited<ReturnType<typeof buildExhibitionSnapshot>>
