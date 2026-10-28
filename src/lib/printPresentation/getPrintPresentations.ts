import { captureError } from '@/lib/observability/captureError'
import { getPrintPresentationsEnabled } from '@/lib/settings'

import { isCurrentRecord } from './currentInputs'
import { pieceArea } from './geometry'
import { presentationInputs } from './inputs'
import { loadPresentationSources } from './loadSources'
import { shotMode } from './look'
import { presentationView, type PresentationView } from './record'

export type { PresentationView }

/**
 * The print presentations public pages show, by artwork id: only while the go-live switch is on,
 * and only renders that still fit the work and are served from here (`isCurrentRecord`). A work
 * that's missing, out of date or not eligible is simply absent — its page shows the plain image.
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
      const inputs = presentationInputs(source)
      if (!inputs || !isCurrentRecord(source.id, source.record, inputs)) continue
      views[source.id] = {
        ...presentationView(source.record),
        piece: pieceArea(shotMode(inputs.frame), inputs.ratio, source.record.window),
      }
    }
    return views
  } catch (err) {
    captureError(err, { flow: 'content', stage: 'print-presentations-read', level: 'warning' })
    return {}
  }
}
