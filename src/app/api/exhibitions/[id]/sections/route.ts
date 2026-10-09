import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { validateSectionTitle } from '@/lib/exhibitionSections'
import {
  requireExhibitionOwner,
  SECTION_DTO_SELECT,
  toSectionDto,
} from '@/lib/exhibitionSectionAccess'
import prisma from '@/lib/prisma'

type Context = { params: Promise<{ id: string }> }

/* ------------------------ GET ------------------------ */
export async function GET(_req: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const { error } = await requireExhibitionOwner(id)
    if (error) return error

    const sections = await prisma.exhibitionSection.findMany({
      where: { exhibitionId: id },
      select: SECTION_DTO_SELECT,
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(sections.map(toSectionDto))
  } catch (error) {
    console.error('[GET /api/exhibitions/[id]/sections] error:', error)
    return NextResponse.json({ error: 'Failed to load sections' }, { status: 500 })
  }
}

/* ------------------------ POST ------------------------ */
export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const { error } = await requireExhibitionOwner(id)
    if (error) return error

    const body = (await request.json().catch(() => ({}))) as { title?: unknown }
    const existing = await prisma.exhibitionSection.findMany({
      where: { exhibitionId: id },
      select: { title: true, order: true },
    })
    const result = validateSectionTitle(
      body.title,
      existing.map((s) => s.title),
    )
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

    // New sections land at the bottom of the page.
    const order = existing.reduce((max, s) => Math.max(max, s.order), -1) + 1
    const section = await prisma.exhibitionSection.create({
      data: { exhibitionId: id, title: result.title, order },
      select: SECTION_DTO_SELECT,
    })
    return NextResponse.json(toSectionDto(section), { status: 201 })
  } catch (error) {
    console.error('[POST /api/exhibitions/[id]/sections] error:', error)
    return NextResponse.json({ error: 'Failed to create section' }, { status: 500 })
  }
}
