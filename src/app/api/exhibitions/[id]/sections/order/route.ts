import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  requireExhibitionOwner,
  SECTION_DTO_SELECT,
  toSectionDto,
} from '@/lib/exhibitionSectionAccess'
import prisma from '@/lib/prisma'

type Context = { params: Promise<{ id: string }> }

/* ------------------------ PUT (reorder) ------------------------ */
export async function PUT(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const { error } = await requireExhibitionOwner(id)
    if (error) return error

    const body = (await request.json().catch(() => ({}))) as { sectionIds?: unknown }
    const requested = body.sectionIds
    const current = await prisma.exhibitionSection.findMany({
      where: { exhibitionId: id },
      select: { id: true },
    })
    const currentIds = new Set(current.map((s) => s.id))

    // The new order must be a permutation of exactly this exhibition's
    // sections: nothing dropped, nothing doubled, nothing from another show.
    const valid =
      Array.isArray(requested) &&
      requested.every((v): v is string => typeof v === 'string') &&
      requested.length === currentIds.size &&
      new Set(requested).size === requested.length &&
      requested.every((sectionId) => currentIds.has(sectionId))
    if (!valid) {
      return NextResponse.json(
        { error: 'The section list changed. Reload the page and try again.' },
        { status: 400 },
      )
    }

    await prisma.$transaction(
      (requested as string[]).map((sectionId, order) =>
        prisma.exhibitionSection.update({ where: { id: sectionId }, data: { order } }),
      ),
    )

    const sections = await prisma.exhibitionSection.findMany({
      where: { exhibitionId: id },
      select: SECTION_DTO_SELECT,
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(sections.map(toSectionDto))
  } catch (error) {
    console.error('[PUT /api/exhibitions/[id]/sections/order] error:', error)
    return NextResponse.json({ error: 'Failed to reorder sections' }, { status: 500 })
  }
}
