import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireAdminOrAbove } from '@/lib/authUtils'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import { currentPresentation } from '@/lib/printPresentation/currentInputs'
import { shotFrame } from '@/lib/printPresentation/geometry'
import type { PresentationInputs } from '@/lib/printPresentation/inputs'
import { makeLook, shotMode } from '@/lib/printPresentation/look'
import {
  PRESENTATION_WIDTH_PX,
  isPresentationWindow,
  type PrintPresentationRecord,
} from '@/lib/printPresentation/record'
import {
  deletePresentationFiles,
  presentationObjectSize,
  presentationPublicUrls,
} from '@/lib/printPresentation/storage'

/** The large render's width over its height — the shot's shape, the same for both sizes. */
const shotAspect = (inputs: PresentationInputs) => {
  const mode = shotMode(inputs.frame)
  const look = makeLook(inputs.seed, mode, inputs.edition ?? 1)
  const { widthPx, heightPx } = shotFrame(mode, inputs.ratio, PRESENTATION_WIDTH_PX.large, look)
  return widthPx / heightPx
}

/**
 * PUT: save a stored render as the artwork's print presentation. The client sends only the
 * fingerprint it rendered and where the artwork's window is; the server builds the record (its
 * URLs come from the fingerprint, never from the client). Nothing is saved unless the render is of
 * the current look and both files are stored. The previous render's files go once it's replaced.
 */
export async function PUT(req: NextRequest, context: { params: Promise<{ artworkId: string }> }) {
  const { error } = await requireAdminOrAbove()
  if (error) return error

  try {
    const { artworkId } = await context.params
    const body = await req.json().catch(() => null)
    const fingerprint: unknown = body?.fingerprint
    const window: unknown = body?.window

    const current = await currentPresentation(artworkId)
    if (!current) {
      return NextResponse.json({ error: 'No presentation for this artwork' }, { status: 404 })
    }
    if (typeof fingerprint !== 'string' || !isPresentationWindow(window)) {
      return NextResponse.json(
        { error: 'fingerprint and a window inside the shot are required' },
        { status: 400 },
      )
    }
    if (current.inputs.fingerprint !== fingerprint) {
      return NextResponse.json({ error: 'This render is out of date' }, { status: 409 })
    }

    const sizes = await Promise.all([
      presentationObjectSize(artworkId, fingerprint, 'large'),
      presentationObjectSize(artworkId, fingerprint, 'small'),
    ])
    if (sizes.some((size) => !size)) {
      return NextResponse.json({ error: 'Both files must be stored first' }, { status: 400 })
    }

    const record: PrintPresentationRecord = {
      fingerprint,
      mode: current.inputs.mode,
      edition: current.inputs.edition,
      window: { x: window.x, y: window.y, w: window.w, h: window.h },
      aspect: shotAspect(current.inputs),
      urls: presentationPublicUrls(artworkId, fingerprint),
      renderedAt: new Date().toISOString(),
    }
    await prisma.artwork.update({ where: { id: artworkId }, data: { printPresentation: record } })

    const previous = current.source.record
    if (previous && previous.fingerprint !== fingerprint) {
      await deletePresentationFiles(previous, artworkId).catch((err) =>
        captureError(err, {
          flow: 'upload',
          stage: 'print-presentation-cleanup',
          level: 'warning',
        }),
      )
    }
    return NextResponse.json({ record })
  } catch (err) {
    console.error('[PUT /api/admin/print-presentations/[artworkId]] error:', err)
    captureError(err, { flow: 'upload', stage: 'print-presentation-save', level: 'error' })
    return NextResponse.json({ error: 'Failed to save the presentation' }, { status: 500 })
  }
}
