import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import type { Prisma } from '@/generated/prisma'
import { requireAdminOrAbove } from '@/lib/authUtils'
import { isBakeRecord } from '@/lib/bake/bakeRecord'
import { loadBakeFingerprint } from '@/lib/bake/loadBakeFingerprint'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'

/** The id of the bake visitors get now (the published snapshot's), or null. */
const publishedBakeIdOf = (snapshot: unknown): string | null => {
  const id = (snapshot as { exhibition?: { bake?: { id?: unknown } | null } } | null)?.exhibition
    ?.bake?.id
  return typeof id === 'string' ? id : null
}

/** POST { bakeId }: the admin has looked at this exact bake of the room as it stands now. */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminOrAbove()
  if (error) return error

  try {
    const { id } = await context.params
    const body = await req.json().catch(() => null)
    const bakeId: unknown = body?.bakeId
    if (typeof bakeId !== 'string') {
      return NextResponse.json({ error: 'bakeId is required' }, { status: 400 })
    }

    const exhibition = await prisma.exhibition.findUnique({
      where: { id },
      select: { bake: true, published: true, spacePublished: true, publishedSnapshot: true },
    })
    if (!exhibition) return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })

    const bake: unknown = exhibition.bake
    if (!isBakeRecord(bake) || bake.id !== bakeId) {
      return NextResponse.json({ error: 'That is not the current bake' }, { status: 409 })
    }
    if (bake.fingerprint !== (await loadBakeFingerprint(id))) {
      return NextResponse.json({ error: 'The room changed since this bake' }, { status: 409 })
    }

    const reviewed = { ...bake, reviewedAt: new Date().toISOString() }
    // A live room whose visitors still get another bake now has something to publish: the
    // dashboard offers "Update Exhibition" only for pending changes, and that ships this bake.
    const awaitsPublish =
      exhibition.published &&
      exhibition.spacePublished &&
      publishedBakeIdOf(exhibition.publishedSnapshot) !== bake.id
    await prisma.exhibition.update({
      where: { id },
      data: {
        bake: reviewed as unknown as Prisma.InputJsonValue,
        ...(awaitsPublish && { hasPendingChanges: true }),
      },
    })
    return NextResponse.json(reviewed)
  } catch (err) {
    console.error('[POST /api/exhibitions/[id]/bake/reviewed] error:', err)
    captureError(err, { flow: 'upload', stage: 'bake-reviewed', level: 'error' })
    return NextResponse.json({ error: 'Failed to mark bake reviewed' }, { status: 500 })
  }
}
