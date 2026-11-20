import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireAdminOrAbove } from '@/lib/authUtils'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import { currentPresentation } from '@/lib/printPresentation/currentInputs'
import { shotFrame } from '@/lib/printPresentation/geometry'
import type { PresentationInputs } from '@/lib/printPresentation/inputs'
import { NO_FRAME, makeLook, shotMode } from '@/lib/printPresentation/look'
import { photoInputs, renderCopy } from '@/lib/printPresentation/photoInputs'
import {
  PRESENTATION_WIDTH_PX,
  RENDER_ID,
  isPresentationWindow,
  type PrintPresentationRecord,
} from '@/lib/printPresentation/record'
import {
  deletePresentationFiles,
  photoPublicUrls,
  presentationObjectSize,
  presentationPublicUrls,
  storedRenderComplete,
} from '@/lib/printPresentation/storage'

/** The large render's width over its height — the shot's shape, the same for both sizes. */
const shotAspect = (inputs: PresentationInputs) => {
  const mode = shotMode(inputs.frame)
  const look = makeLook(inputs.seed, mode, inputs.edition ?? 1)
  const { widthPx, heightPx } = shotFrame(mode, inputs.ratio, PRESENTATION_WIDTH_PX.large, look)
  return widthPx / heightPx
}

/**
 * PUT: save a stored render as the artwork's print presentation. The client sends only what it
 * rendered — both fingerprints, the render's id (from POST …/uploads), the copy it pencilled — and
 * where the artwork's window is; the server builds the record (its URLs come from those, never
 * from the client). Nothing is saved unless the render is of the current look and every file is
 * stored (the framed render's two, and each photo's two). The previous render's files go only once
 * this one is saved.
 */
export async function PUT(req: NextRequest, context: { params: Promise<{ artworkId: string }> }) {
  const { error } = await requireAdminOrAbove()
  if (error) return error

  try {
    const { artworkId } = await context.params
    const body = await req.json().catch(() => null)
    const fingerprint: unknown = body?.fingerprint
    const window: unknown = body?.window
    const renderId: unknown = body?.renderId
    const viewsFingerprint: unknown = body?.viewsFingerprint ?? null
    const copy: unknown = body?.copy ?? null

    const current = await currentPresentation(artworkId)
    if (!current) {
      return NextResponse.json({ error: 'No presentation for this artwork' }, { status: 404 })
    }
    if (
      typeof fingerprint !== 'string' ||
      !isPresentationWindow(window) ||
      typeof renderId !== 'string' ||
      !RENDER_ID.test(renderId)
    ) {
      return NextResponse.json(
        { error: 'fingerprint, the render id and a window inside the shot are required' },
        { status: 400 },
      )
    }
    const photo = photoInputs(current.source, current.inputs)
    if (
      current.inputs.fingerprint !== fingerprint ||
      (photo?.fingerprint ?? null) !== viewsFingerprint
    ) {
      return NextResponse.json({ error: 'This render is out of date' }, { status: 409 })
    }
    // The copy it pencilled: a whole number within the edition, or none for works that carry none.
    const edition = current.inputs.edition
    const nextCopy = renderCopy(current.source, current.inputs)
    const numbered = nextCopy !== null
    const copyOk = numbered
      ? Number.isInteger(copy) && (copy as number) >= 1 && (copy as number) <= (edition ?? 0)
      : copy === null
    if (!copyOk) {
      return NextResponse.json({ error: 'The pencilled copy is not valid' }, { status: 400 })
    }
    // …and the one the work pencils now: a copy sold since the render started (or a stale tab)
    // would save a record that is out of date at once. Like a stale fingerprint, refused.
    if (numbered && copy !== nextCopy) {
      return NextResponse.json({ error: 'This render is out of date' }, { status: 409 })
    }

    const complete = photo
      ? await storedRenderComplete(artworkId, fingerprint, renderId, photo.fingerprint)
      : (
          await Promise.all([
            presentationObjectSize(artworkId, fingerprint, 'large', renderId),
            presentationObjectSize(artworkId, fingerprint, 'small', renderId),
          ])
        ).every((size) => !!size)
    if (!complete) {
      return NextResponse.json({ error: 'Every file must be stored first' }, { status: 400 })
    }
    const renderedAt = new Date().toISOString()

    const record: PrintPresentationRecord = {
      fingerprint,
      mode: current.inputs.mode,
      edition: current.inputs.edition,
      window: { x: window.x, y: window.y, w: window.w, h: window.h },
      aspect: shotAspect(current.inputs),
      urls: presentationPublicUrls(artworkId, fingerprint, renderId),
      renderedAt,
      frame: current.inputs.frame ?? NO_FRAME,
      passepartout: current.inputs.passepartout,
      ratio: current.inputs.ratio,
      renderId,
      ...(numbered ? { copy: copy as number } : {}),
      ...(photo
        ? {
            views: {
              fingerprint: photo.fingerprint,
              urls: photoPublicUrls(artworkId, photo.fingerprint, renderId),
              renderedAt,
            },
          }
        : {}),
    }
    await prisma.artwork.update({ where: { id: artworkId }, data: { printPresentation: record } })

    // Every render has its own file names, so the previous one's files are never this one's.
    const previous = current.source.record
    if (previous && (previous.fingerprint !== fingerprint || previous.renderId !== renderId)) {
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
