import { NextResponse } from 'next/server'

import { requireOwnership } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

/**
 * The gate every section route goes through: the exhibition must exist and the
 * caller must be allowed to edit it — the same `requireOwnership` check the
 * exhibition PUT uses (owner, admin impersonating the owner, or superAdmin).
 */
export async function requireExhibitionOwner(
  exhibitionId: string,
): Promise<{ error: NextResponse | null }> {
  const exhibition = await prisma.exhibition.findUnique({
    where: { id: exhibitionId },
    select: { userId: true },
  })
  if (!exhibition) {
    return { error: NextResponse.json({ error: 'Exhibition not found' }, { status: 404 }) }
  }
  const { error } = await requireOwnership(exhibition.userId)
  return { error: error ?? null }
}

/** What every section route returns per section. Counts page members only. */
export const SECTION_DTO_SELECT = {
  id: true,
  title: true,
  order: true,
  _count: { select: { exhibitionArtworks: { where: { showOnPage: true } } } },
} as const

export type SectionDto = { id: string; title: string; order: number; artworkCount: number }

export function toSectionDto(row: {
  id: string
  title: string
  order: number
  _count: { exhibitionArtworks: number }
}): SectionDto {
  return {
    id: row.id,
    title: row.title,
    order: row.order,
    artworkCount: row._count.exhibitionArtworks,
  }
}
