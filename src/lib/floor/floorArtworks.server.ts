import prisma from '@/lib/prisma'

import type { FloorArtwork } from './floorArtworks'
import { floorArtworkIds, parseFloorLayout } from './floorLayout'

/**
 * The floor's Objects, as the room draws them: the artist's own Objects with a ready model only
 * (anything else in a stored layout is simply not drawn). Keyed by artwork id.
 */
export async function loadFloorArtworks(
  floorLayout: unknown,
  userId: string,
): Promise<Record<string, FloorArtwork>> {
  const ids = floorArtworkIds(parseFloorLayout(floorLayout))
  if (ids.length === 0) return {}
  const rows = await prisma.artwork.findMany({
    where: {
      id: { in: ids },
      userId,
      artworkType: 'object',
      modelStatus: 'ready',
      modelUrl: { not: null },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      author: true,
      imageUrl: true,
      modelUrl: true,
      modelBoundsCm: true,
      user: { select: { name: true, lastName: true } },
    },
  })
  return Object.fromEntries(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        slug: r.slug,
        title: r.title,
        author: r.author || [r.user.name, r.user.lastName].filter(Boolean).join(' '),
        imageUrl: r.imageUrl,
        modelUrl: r.modelUrl!,
        boundsCm: (r.modelBoundsCm as FloorArtwork['boundsCm']) ?? null,
      },
    ]),
  )
}
