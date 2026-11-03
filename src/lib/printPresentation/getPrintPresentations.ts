import { captureError } from '@/lib/observability/captureError'
import { getPrintPresentationsEnabled } from '@/lib/settings'

import { shownRecord } from './currentInputs'
import { pieceArea } from './geometry'
import { presentationInputs } from './inputs'
import { loadPresentationSources } from './loadSources'
import { shotMode } from './look'
import { presentationView, type PresentationView } from './record'

export type { PresentationView }

/**
 * The print presentations public pages show, by artwork id: only while the go-live switch is on,
 * and only renders served from here that still show the work truly — its latest render, up to
 * date or not (`shownRecord`). A work with none, or not eligible, is simply absent: its page shows
 * the plain image.
 *
 * FAILS CLOSED: if anything goes wrong reading them, pages show today's plain images.
 */
export async function getPrintPresentations(
  artworkIds: string[],
): Promise<Record<string, PresentationView>> {
  if (artworkIds.length === 0 || !(await getPrintPresentationsEnabled())) return {}
  try {
    const sources = await loadPresentationSources({ ids: artworkIds })
    const views: Record<string, PresentationView> = {}
    for (const source of sources) {
      if (!source.record) continue
      const shot = shownRecord(source.id, source.record, presentationInputs(source))
      if (!shot) continue
      views[source.id] = {
        ...presentationView(source.record),
        piece: pieceArea(shotMode(shot.frame), shot.ratio, source.record.window),
      }
    }
    return views
  } catch (err) {
    captureError(err, { flow: 'content', stage: 'print-presentations-read', level: 'warning' })
    return {}
  }
}
