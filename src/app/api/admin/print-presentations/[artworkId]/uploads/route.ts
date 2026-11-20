import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireAdminOrAbove } from '@/lib/authUtils'
import { captureError } from '@/lib/observability/captureError'
import { currentPresentation } from '@/lib/printPresentation/currentInputs'
import { photoInputs } from '@/lib/printPresentation/photoInputs'
import {
  createPhotoUploads,
  createPresentationUploads,
  newRenderId,
} from '@/lib/printPresentation/storage'

/**
 * POST: start storing a render — the framed presentation and, for a work with a web image, its
 * three photo views: the render's id (in every file name; the server picks it) and one upload URL
 * per file. Only for the artwork's current look (`fingerprint`, and `viewsFingerprint` for the
 * photos): a render of an out-of-date one is refused, so a stale browser tab can't store the wrong
 * frame, edition or image.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ artworkId: string }> }) {
  const { error } = await requireAdminOrAbove()
  if (error) return error

  try {
    const { artworkId } = await context.params
    const body = await req.json().catch(() => null)
    const fingerprint: unknown = body?.fingerprint
    const viewsFingerprint: unknown = body?.viewsFingerprint ?? null
    if (typeof fingerprint !== 'string') {
      return NextResponse.json({ error: 'fingerprint is required' }, { status: 400 })
    }

    const current = await currentPresentation(artworkId)
    if (!current) {
      return NextResponse.json({ error: 'No presentation for this artwork' }, { status: 404 })
    }
    const photo = photoInputs(current.source, current.inputs)
    if (
      current.inputs.fingerprint !== fingerprint ||
      (photo?.fingerprint ?? null) !== viewsFingerprint
    ) {
      return NextResponse.json({ error: 'This render is out of date' }, { status: 409 })
    }

    const renderId = newRenderId()
    const [framed, photos] = await Promise.all([
      createPresentationUploads(artworkId, fingerprint, renderId),
      photo ? createPhotoUploads(artworkId, photo.fingerprint, renderId) : null,
    ])
    return NextResponse.json({ renderId, framed, photos })
  } catch (err) {
    console.error('[POST /api/admin/print-presentations/[artworkId]/uploads] error:', err)
    captureError(err, { flow: 'upload', stage: 'print-presentation-uploads', level: 'error' })
    return NextResponse.json({ error: 'Failed to start the upload' }, { status: 500 })
  }
}
