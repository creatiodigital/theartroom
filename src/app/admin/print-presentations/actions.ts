'use server'

/**
 * The admin's "Print presentations" page: every image work and the state of its presentation, and
 * the go-live switch. Rendering itself happens in the admin's browser; its files and record go
 * through `/api/admin/print-presentations/[artworkId]/…`.
 */
import { requireAdminAction } from '@/lib/authUtils'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import { isCurrentRecord } from '@/lib/printPresentation/currentInputs'
import { presentationInputs, type PresentationInputs } from '@/lib/printPresentation/inputs'
import { loadPresentationSources } from '@/lib/printPresentation/loadSources'
import { isFrameChoice, type FrameChoice } from '@/lib/printPresentation/look'
import { presentationView, type PresentationView } from '@/lib/printPresentation/record'
import { getPrintPresentationsEnabled, setPrintPresentationsEnabled } from '@/lib/settings'

export type PresentationStatus = 'missing' | 'current' | 'stale' | 'ineligible'

export type PresentationRow = {
  artworkId: string
  title: string
  artistName: string
  /** The artist's account, for the page's artist filter. */
  artistId: string
  accountName: string
  imageUrl: string | null
  status: PresentationStatus
  /** What a render needs; null when the work gets no presentation. */
  inputs: PresentationInputs | null
  /** The stored render, whatever the switch says — the admin's preview. */
  view: PresentationView | null
}

type Failure = { ok: false; error: string }

/** Every image work (text, sound and video works never get a presentation), artist by artist. */
export async function listPrintPresentations(): Promise<
  { ok: true; rows: PresentationRow[]; enabled: boolean } | Failure
> {
  const guard = await requireAdminAction()
  if (!guard.ok) return { ok: false, error: guard.error }
  try {
    const [sources, enabled] = await Promise.all([
      loadPresentationSources(),
      getPrintPresentationsEnabled(),
    ])
    const rows = sources
      .filter((s) => s.artworkType === 'image')
      .map((source): PresentationRow => {
        const inputs = presentationInputs(source)
        const { record } = source
        const status: PresentationStatus = !inputs
          ? 'ineligible'
          : !record
            ? 'missing'
            : isCurrentRecord(source.id, record, inputs)
              ? 'current'
              : 'stale'
        return {
          artworkId: source.id,
          title: source.title,
          artistName: source.artistName,
          artistId: source.artistId,
          accountName: source.accountName,
          imageUrl: source.imageUrl,
          status,
          inputs,
          view: record ? presentationView(record) : null,
        }
      })
    return { ok: true, rows, enabled }
  } catch (err) {
    captureError(err, { flow: 'admin', stage: 'list-print-presentations' })
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load the list.' }
  }
}

/**
 * The frame a work is rendered in (or none), saved as soon as it's picked. A work whose render used
 * another one then reads as out of date, so the next render (one by one, or all) uses this one.
 */
export async function setPresentationFrame(
  artworkId: string,
  frame: FrameChoice,
): Promise<{ ok: true } | Failure> {
  const guard = await requireAdminAction()
  if (!guard.ok) return { ok: false, error: guard.error }
  if (!isFrameChoice(frame)) return { ok: false, error: 'Unknown frame.' }
  try {
    await prisma.artwork.update({ where: { id: artworkId }, data: { presentationFrame: frame } })
    return { ok: true }
  } catch (err) {
    captureError(err, { flow: 'admin', stage: 'set-presentation-frame' })
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to save the frame.' }
  }
}

/** The go-live switch: grids and artwork pages show the presentations only while it's on. */
export async function setPrintPresentationsSwitch(
  enabled: boolean,
): Promise<{ ok: true; enabled: boolean } | Failure> {
  const guard = await requireAdminAction()
  if (!guard.ok) return { ok: false, error: guard.error }
  try {
    await setPrintPresentationsEnabled(enabled)
    return { ok: true, enabled }
  } catch (err) {
    captureError(err, { flow: 'admin', stage: 'toggle-print-presentations' })
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update the switch.' }
  }
}
