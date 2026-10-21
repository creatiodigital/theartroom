import { randomUUID } from 'crypto'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireAdminOrAbove } from '@/lib/authUtils'
import { BAKE_FILE_PATTERN, createBakeUploads } from '@/lib/bake/bakeStorage'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'

const MAX_FILES = 12

/** POST: start a bake. Mints a fresh bake id and one upload URL per map file. */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminOrAbove()
  if (error) return error

  try {
    const { id } = await context.params
    const body = await req.json().catch(() => null)
    const files: unknown = body?.files
    if (
      !Array.isArray(files) ||
      files.length === 0 ||
      files.length > MAX_FILES ||
      !files.every((f) => typeof f === 'string' && BAKE_FILE_PATTERN.test(f)) ||
      new Set(files).size !== files.length
    ) {
      return NextResponse.json(
        { error: `files must be 1-${MAX_FILES} unique names like wall-light.png` },
        { status: 400 },
      )
    }

    const exhibition = await prisma.exhibition.findUnique({ where: { id }, select: { id: true } })
    if (!exhibition) return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })

    const bakeId = randomUUID()
    const uploads = await createBakeUploads(id, bakeId, files as string[])
    return NextResponse.json({
      bakeId,
      uploads: uploads.map(({ file, url, publicUrl }) => ({ file, url, publicUrl })),
    })
  } catch (err) {
    console.error('[POST /api/exhibitions/[id]/bake/uploads] error:', err)
    captureError(err, { flow: 'upload', stage: 'bake-uploads', level: 'error' })
    return NextResponse.json({ error: 'Failed to start bake upload' }, { status: 500 })
  }
}
