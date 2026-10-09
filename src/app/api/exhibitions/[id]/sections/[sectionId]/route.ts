import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { validateSectionTitle } from '@/lib/exhibitionSections'
import {
  requireExhibitionOwner,
  SECTION_DTO_SELECT,
  toSectionDto,
} from '@/lib/exhibitionSectionAccess'
import prisma from '@/lib/prisma'

type Context = { params: Promise<{ id: string; sectionId: string }> }

// A section is only ever addressed through its own exhibition. An id from a
// different show is "not found" here, never a cross-exhibition write.
const notFound = () => NextResponse.json({ error: 'Section not found' }, { status: 404 })

/* ------------------------ PATCH (rename) ------------------------ */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id, sectionId } = await context.params
    const { error } = await requireExhibitionOwner(id)
    if (error) return error

    const section = await prisma.exhibitionSection.findFirst({
      where: { id: sectionId, exhibitionId: id },
      select: { id: true },
    })
    if (!section) return notFound()

    const body = (await request.json().catch(() => ({}))) as { title?: unknown }
    // Compare against the OTHER sections only, so "Mistery" → "MISTERY" is fine.
    const others = await prisma.exhibitionSection.findMany({
      where: { exhibitionId: id, id: { not: sectionId } },
      select: { title: true },
    })
    const result = validateSectionTitle(
      body.title,
      others.map((s) => s.title),
    )
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

    // Only the title changes. Works reference the section by id, so every
    // assignment survives a rename untouched.
    const updated = await prisma.exhibitionSection.update({
      where: { id: sectionId },
      data: { title: result.title },
      select: SECTION_DTO_SELECT,
    })
    return NextResponse.json(toSectionDto(updated))
  } catch (error) {
    console.error('[PATCH /api/exhibitions/[id]/sections/[sectionId]] error:', error)
    return NextResponse.json({ error: 'Failed to rename section' }, { status: 500 })
  }
}

/* ------------------------ DELETE ------------------------ */
export async function DELETE(_req: NextRequest, context: Context) {
  try {
    const { id, sectionId } = await context.params
    const { error } = await requireExhibitionOwner(id)
    if (error) return error

    const section = await prisma.exhibitionSection.findFirst({
      where: { id: sectionId, exhibitionId: id },
      select: { id: true },
    })
    if (!section) return notFound()

    // `onDelete: SetNull` on ExhibitionArtwork.sectionId returns every work in
    // this section to "no section". No artwork row is deleted or hidden.
    await prisma.exhibitionSection.delete({ where: { id: sectionId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/exhibitions/[id]/sections/[sectionId]] error:', error)
    return NextResponse.json({ error: 'Failed to delete section' }, { status: 500 })
  }
}
