import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import type { Prisma } from '@/generated/prisma'
import { requireAdminOrAbove } from '@/lib/authUtils'
import { isBakeRecord } from '@/lib/bake/bakeRecord'
import type { BakeRecord } from '@/lib/bake/bakeRecord'
import {
  BAKE_SEGMENT_PATTERN,
  bakeFileOfUrl,
  bakeObjectSize,
  deleteBakeObjects,
} from '@/lib/bake/bakeStorage'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'

const idOf = (bake: unknown): string | null => {
  const id = (bake as { id?: unknown } | null)?.id
  return typeof id === 'string' ? id : null
}

/**
 * PUT: save the draft bake. All or nothing: the draft is written only after the
 * record is valid, every map lies under THIS exhibition's `bakes/{record.id}/`
 * folder, and every map object exists with bytes.
 */
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdminOrAbove()
  if (error) return error

  try {
    const { id } = await context.params
    const raw: unknown = await req.json().catch(() => null)
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return NextResponse.json({ error: 'Invalid bake record' }, { status: 400 })
    }
    // The server owns bakedBy and reviewedAt: set them first, then validate the whole record.
    const body: unknown = { ...raw, bakedBy: session!.user.id, reviewedAt: null }
    if (!isBakeRecord(body) || !BAKE_SEGMENT_PATTERN.test(body.id)) {
      return NextResponse.json({ error: 'Invalid bake record' }, { status: 400 })
    }

    const exhibition = await prisma.exhibition.findUnique({ where: { id }, select: { bake: true } })
    if (!exhibition) return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })

    const urls = body.maps.map((m) => m.url)
    if (new Set(urls).size !== urls.length || urls.some((u) => !bakeFileOfUrl(id, body.id, u))) {
      return NextResponse.json(
        { error: 'Every map must be a distinct file of this bake' },
        { status: 400 },
      )
    }
    const sizes = await Promise.all(urls.map((u) => bakeObjectSize(u)))
    if (sizes.some((s) => s === null || s <= 0)) {
      return NextResponse.json({ error: 'Every map must be uploaded first' }, { status: 400 })
    }

    const record: BakeRecord = body
    await prisma.exhibition.update({
      where: { id },
      data: { bake: record as unknown as Prisma.InputJsonValue },
    })

    // The replaced draft's files go, unless the row, re-read now, still publishes it or holds
    // it as the draft (a publish or another bake save since the read above may have moved
    // either pointer).
    const previousId = idOf(exhibition.bake)
    if (previousId && previousId !== record.id) {
      try {
        const now = await prisma.exhibition.findUnique({
          where: { id },
          select: { bake: true, publishedSnapshot: true },
        })
        const snapshot = now?.publishedSnapshot as { exhibition?: { bake?: unknown } } | null
        if (previousId !== idOf(now?.bake) && previousId !== idOf(snapshot?.exhibition?.bake)) {
          await deleteBakeObjects(id, previousId)
        }
      } catch (err) {
        console.error('[PUT /api/exhibitions/[id]/bake] cleanup failed:', err)
        captureError(err, { flow: 'upload', stage: 'bake-cleanup', level: 'warning' })
      }
    }

    return NextResponse.json(record)
  } catch (err) {
    console.error('[PUT /api/exhibitions/[id]/bake] error:', err)
    captureError(err, { flow: 'upload', stage: 'bake-save', level: 'error' })
    return NextResponse.json({ error: 'Failed to save bake' }, { status: 500 })
  }
}
