import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { auth } from '@/auth'
import { isAdminOrAbove } from '@/lib/authUtils'
import { EMAIL_BRAND } from '@/lib/emails/brand'
import { sendModelRequestAdminEmail } from '@/lib/emails/objectModel'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import {
  buildModelRequestKey,
  getPresignedUploadUrl,
  getR2ObjectSize,
  listAllR2Keys,
  modelRequestPrefix,
  publicUrlForKey,
} from '@/lib/r2'
import { rateLimit } from '@/lib/rateLimit'
import { sanitizeMultiline } from '@/utils/sanitizeLine'

/**
 * Asking for an Object's 3D model (docs/objects O4): the artist (or the team for them).
 *
 *  - `{ type: 'request-upload', fileName, fileSize }` → a presigned PUT for an optional scan or
 *    model (GLB, OBJ, FBX, STL; up to 200 MB) under the artwork's request prefix.
 *  - `{ type: 'send', kind: 'model' | 'change', note?, fileKey? }` → `modelStatus: 'requested'`,
 *    `modelRequestedAt`, and the gallery's email. "model" from none; "change" from ready (with a
 *    note, required).
 *  - GET (team only) → the files artists sent, newest first, with their address to download.
 */
const REQUEST_FILE_TYPES = ['glb', 'obj', 'fbx', 'stl']
const MAX_REQUEST_FILE_BYTES = 200 * 1024 * 1024
const MAX_NOTE = 2000

type Gate =
  | { error: string; status: 401 | 403 | 404 | 400 }
  | {
      isAdmin: boolean
      userId: string
      artwork: {
        id: string
        title: string
        modelStatus: string
        user: { name: string | null; lastName: string | null }
      }
    }

async function gate(artworkId: string): Promise<Gate> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated', status: 401 }
  const artwork = await prisma.artwork.findUnique({
    where: { id: artworkId },
    select: {
      id: true,
      userId: true,
      title: true,
      artworkType: true,
      modelStatus: true,
      user: { select: { name: true, lastName: true } },
    },
  })
  if (!artwork) return { error: 'Artwork not found', status: 404 }
  const isAdmin = isAdminOrAbove(session.user.userType)
  const effectiveUserId = session.impersonating?.id || session.user.id
  if (!isAdmin && artwork.userId !== effectiveUserId) return { error: 'Forbidden', status: 403 }
  if (artwork.artworkType !== 'object') {
    return { error: 'Only an Object has a 3D model.', status: 400 }
  }
  return { isAdmin, userId: session.user.id, artwork }
}

/** `<ts>-<suffix>-<slug>.<ext>` → when it was sent and a readable name. */
function describeRequestKey(key: string) {
  const file = key.slice(key.lastIndexOf('/') + 1)
  const match = /^(\d+)-[a-f0-9]+-(.+)$/.exec(file)
  return {
    key,
    url: publicUrlForKey(key),
    name: match ? match[2] : file,
    sentAt: match ? new Date(Number(match[1])).toISOString() : null,
  }
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const g = await gate(id)
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  // The files' addresses are the team's only: the key is their protection.
  if (!g.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const keys = await listAllR2Keys(modelRequestPrefix(id))
  const files = await Promise.all(
    keys.map(async (key) => ({
      ...describeRequestKey(key),
      sizeBytes: await getR2ObjectSize(key),
    })),
  )
  files.sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))
  return NextResponse.json({ files })
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const g = await gate(id)
    if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
    const body = await request.json()

    if (body.type === 'request-upload') {
      const { success } = await rateLimit({
        name: 'model-request-upload',
        key: g.userId,
        limit: 20,
        windowSeconds: 3600,
      })
      if (!success) {
        return NextResponse.json({ error: 'Too many uploads. Try again shortly.' }, { status: 429 })
      }
      const fileName = typeof body.fileName === 'string' ? body.fileName : ''
      const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
      if (!REQUEST_FILE_TYPES.includes(ext)) {
        return NextResponse.json({ error: 'Send a GLB, OBJ, FBX or STL file.' }, { status: 400 })
      }
      if (typeof body.fileSize === 'number' && body.fileSize > MAX_REQUEST_FILE_BYTES) {
        return NextResponse.json(
          { error: 'The file is too large: at most 200 MB.' },
          { status: 400 },
        )
      }
      const key = buildModelRequestKey(id, fileName, ext)
      // A download for the team, never something a browser renders.
      const presignedUrl = await getPresignedUploadUrl(key, 'application/octet-stream')
      return NextResponse.json({ presignedUrl, key })
    }

    if (body.type === 'send') {
      const kind = body.kind === 'change' ? 'change' : 'model'
      const status = g.artwork.modelStatus
      if (kind === 'model' && status !== 'none') {
        return NextResponse.json(
          {
            error:
              status === 'requested'
                ? 'A 3D model is already in preparation.'
                : 'The 3D model is ready.',
          },
          { status: 409 },
        )
      }
      if (kind === 'change' && status !== 'ready') {
        return NextResponse.json(
          { error: 'There is no ready 3D model to change.' },
          { status: 409 },
        )
      }

      const note =
        typeof body.note === 'string' ? sanitizeMultiline(body.note).trim().slice(0, MAX_NOTE) : ''
      if (kind === 'change' && !note) {
        return NextResponse.json({ error: 'Please say what should change.' }, { status: 400 })
      }

      let file: { name: string; sizeBytes: number | null } | null = null
      if (body.fileKey !== undefined && body.fileKey !== null) {
        const key = body.fileKey
        const prefix = modelRequestPrefix(id)
        if (typeof key !== 'string' || !key.startsWith(prefix) || key.includes('..')) {
          return NextResponse.json({ error: 'Invalid file' }, { status: 400 })
        }
        const sizeBytes = await getR2ObjectSize(key)
        if (sizeBytes === null) {
          return NextResponse.json(
            { error: 'The file did not arrive. Please try again.' },
            { status: 400 },
          )
        }
        file = { name: describeRequestKey(key).name, sizeBytes }
      }

      const updated = await prisma.artwork.update({
        where: { id },
        data: { modelStatus: 'requested', modelRequestedAt: new Date() },
        select: { modelStatus: true, modelRequestedAt: true },
      })

      const artistName =
        [g.artwork.user.name, g.artwork.user.lastName].filter(Boolean).join(' ') || 'The artist'
      const sent = await sendModelRequestAdminEmail({
        kind,
        artworkTitle: g.artwork.title,
        artistName,
        note: note || null,
        file,
        editUrl: `${EMAIL_BRAND.siteUrl}/dashboard/artworks/${id}/edit`,
      })
      if (!sent.ok) {
        console.warn('[POST /api/artworks/[id]/model-request] admin email:', sent.error)
        captureError(new Error(sent.error), {
          flow: 'upload',
          stage: 'object-model-request',
          level: 'warning',
        })
      }

      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
  } catch (error) {
    console.error('[POST /api/artworks/[id]/model-request] error:', error)
    captureError(error, { flow: 'upload', stage: 'object-model-request', level: 'error' })
    return NextResponse.json({ error: 'The request could not be sent.' }, { status: 500 })
  }
}
