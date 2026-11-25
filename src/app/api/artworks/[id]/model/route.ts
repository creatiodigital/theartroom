import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { auth } from '@/auth'
import { isAdminOrAbove } from '@/lib/authUtils'
import { captureError } from '@/lib/observability/captureError'
import { boundsToCm, checkGlb, GLB_MAX_BYTES, glbPasses } from '@/lib/objects/glb'
import { gatherServerGlbFacts } from '@/lib/objects/glbFacts.server'
import prisma from '@/lib/prisma'
import {
  buildArtworkModelKey,
  deleteFromR2,
  deleteR2KeyDirect,
  getPresignedUploadUrl,
  getPublicBucketObjectBuffer,
  getR2ObjectSize,
} from '@/lib/r2'

// Reading and checking up to 30 MB of glTF takes a few seconds.
export const maxDuration = 60

/**
 * An Object's 3D model (docs/objects O4): the GALLERY TEAM uploads the cleaned .glb.
 *
 *  1. `{ type: 'request-upload', fileSize }` → a presigned PUT for a key this route mints.
 *  2. The browser PUTs the file straight to R2 (it has already passed the checks there).
 *  3. `{ type: 'complete', key }` → the server reads the file back and runs the SAME checks
 *     (`checkGlb`, owner Q-O8) on its own facts. A fail deletes the file and answers 422 with the
 *     rows; a pass stores it: `modelUrl`, size, bounds, `modelStatus: 'ready'`, `modelReadyAt`,
 *     removes the model it replaces. Artists send their .glb files to the gallery directly (owner,
 *     2026-11-25): there is no request, and no email.
 */
const KEY_RE = /^[a-z0-9-]+\/artists\/[a-z0-9-]+\/[a-zA-Z0-9_-]+\/model\/[a-f0-9]+\.glb$/

const isSafeKey = (key: unknown, artworkId: string): key is string =>
  typeof key === 'string' &&
  key.length <= 256 &&
  !key.includes('..') &&
  KEY_RE.test(key) &&
  key.includes(`/${artworkId}/model/`)

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!isAdminOrAbove(session.user.userType)) {
      return NextResponse.json(
        { error: 'Only the gallery team uploads 3D models.' },
        { status: 403 },
      )
    }

    const artwork = await prisma.artwork.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        artworkType: true,
        modelUrl: true,
      },
    })
    if (!artwork) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    if (artwork.artworkType !== 'object') {
      return NextResponse.json({ error: 'Only an Object has a 3D model.' }, { status: 400 })
    }

    const body = await request.json()

    if (body.type === 'request-upload') {
      if (typeof body.fileSize === 'number' && body.fileSize > GLB_MAX_BYTES) {
        return NextResponse.json(
          { error: `The .glb is too large: at most ${GLB_MAX_BYTES / (1024 * 1024)} MB.` },
          { status: 400 },
        )
      }
      const key = await buildArtworkModelKey(artwork.userId, artwork.id)
      const presignedUrl = await getPresignedUploadUrl(key, 'model/gltf-binary')
      return NextResponse.json({ presignedUrl, key })
    }

    if (body.type === 'complete') {
      const { key } = body
      if (!isSafeKey(key, artwork.id)) {
        return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
      }
      const size = await getR2ObjectSize(key)
      if (size === null) {
        return NextResponse.json(
          { error: 'The file did not arrive. Please try again.' },
          { status: 400 },
        )
      }
      if (size > GLB_MAX_BYTES) {
        await deleteR2KeyDirect(key).catch(() => {})
        return NextResponse.json(
          { error: `The .glb is too large: at most ${GLB_MAX_BYTES / (1024 * 1024)} MB.` },
          { status: 400 },
        )
      }

      // The same checks as the browser ran, on the server's own reading of the stored file.
      const bytes = new Uint8Array(await getPublicBucketObjectBuffer(key))
      const facts = await gatherServerGlbFacts(bytes)
      const rows = checkGlb(facts)
      if (!glbPasses(rows)) {
        await deleteR2KeyDirect(key).catch(() => {})
        return NextResponse.json(
          { error: 'The file did not pass the checks, so it was not stored.', rows },
          { status: 422 },
        )
      }

      const url = `${process.env.R2_PUBLIC_URL}/${key}`
      const bounds = boundsToCm(facts.bounds)
      const updated = await prisma.artwork.update({
        where: { id: artwork.id },
        data: {
          modelUrl: url,
          modelSizeBytes: size,
          modelBoundsCm: bounds ?? undefined,
          modelStatus: 'ready',
          modelReadyAt: new Date(),
        },
        select: {
          modelUrl: true,
          modelSizeBytes: true,
          modelBoundsCm: true,
          modelStatus: true,
          modelReadyAt: true,
        },
      })

      // The model it replaces: the row points at the new one, so the old file is now an orphan.
      if (artwork.modelUrl && artwork.modelUrl !== url) {
        await deleteFromR2(artwork.modelUrl).catch((error) =>
          console.warn('[POST /api/artworks/[id]/model] old model not removed:', error),
        )
      }

      return NextResponse.json({ model: updated, rows })
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
  } catch (error) {
    console.error('[POST /api/artworks/[id]/model] error:', error)
    captureError(error, { flow: 'upload', stage: 'object-model', level: 'error' })
    return NextResponse.json({ error: 'The 3D model could not be saved.' }, { status: 500 })
  }
}
