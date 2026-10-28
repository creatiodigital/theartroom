import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireAdminOrAbove } from '@/lib/authUtils'
import { captureError } from '@/lib/observability/captureError'
import { currentPresentation } from '@/lib/printPresentation/currentInputs'
import { createPresentationUploads } from '@/lib/printPresentation/storage'

/**
 * POST: start storing a print presentation render — one upload URL per size. Only for the
 * artwork's current look (`fingerprint`): a render of an out-of-date one is refused, so a stale
 * browser tab can't store the wrong frame or edition.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ artworkId: string }> }) {
  const { error } = await requireAdminOrAbove()
  if (error) return error

  try {
    const { artworkId } = await context.params
    const body = await req.json().catch(() => null)
    const fingerprint: unknown = body?.fingerprint
    if (typeof fingerprint !== 'string') {
      return NextResponse.json({ error: 'fingerprint is required' }, { status: 400 })
    }

    const current = await currentPresentation(artworkId)
    if (!current) {
      return NextResponse.json({ error: 'No presentation for this artwork' }, { status: 404 })
    }
    if (current.inputs.fingerprint !== fingerprint) {
      return NextResponse.json({ error: 'This render is out of date' }, { status: 409 })
    }

    return NextResponse.json(await createPresentationUploads(artworkId, fingerprint))
  } catch (err) {
    console.error('[POST /api/admin/print-presentations/[artworkId]/uploads] error:', err)
    captureError(err, { flow: 'upload', stage: 'print-presentation-uploads', level: 'error' })
    return NextResponse.json({ error: 'Failed to start the upload' }, { status: 500 })
  }
}
