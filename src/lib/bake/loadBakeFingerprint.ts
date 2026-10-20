import prisma from '@/lib/prisma'

import { computeBakeFingerprint } from './fingerprint'
import { spaceLookVersion } from './spaceLookVersion'
import { spaceModelVersion } from './spaceModelVersion'

/**
 * Fingerprints the room an exhibition row and its placed rows make. Each placed row is a full
 * ExhibitionArtwork row with at least `artwork.artworkType` and `artwork.hiddenFromExhibition`
 * (any other artwork fields are ignored), so a caller that already read them — the snapshot
 * builder — judges a bake from the very read it freezes.
 */
export function fingerprintRoom(
  exhibition: Record<string, unknown> & { spaceId: string },
  placed: Record<string, unknown>[],
): string {
  return computeBakeFingerprint({
    exhibition,
    placed,
    spaceModelVersion: spaceModelVersion(exhibition.spaceId),
    spaceLookVersion: spaceLookVersion(exhibition.spaceId),
  })
}

/** Reads the exhibition and its placed works, and fingerprints the room they make. */
export async function loadBakeFingerprint(exhibitionId: string): Promise<string> {
  const exhibition = await prisma.exhibition.findUniqueOrThrow({ where: { id: exhibitionId } })
  const placed = await prisma.exhibitionArtwork.findMany({
    where: { exhibitionId, wallId: { not: null } },
    include: { artwork: { select: { artworkType: true, hiddenFromExhibition: true } } },
  })

  return fingerprintRoom(exhibition, placed)
}
