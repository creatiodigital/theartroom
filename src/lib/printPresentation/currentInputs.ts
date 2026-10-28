import { presentationInputs, type PresentationInputs } from './inputs'
import { loadPresentationSources, type SourceRow } from './loadSources'
import type { PrintPresentationRecord } from './record'
import { presentationPublicUrls } from './storage'

/**
 * Whether a stored render still fits the work AND lives where this deployment serves renders: its
 * fingerprint is the current one and its URLs are this backend's. Local renders (development) and
 * staging share one database; a record whose files this deployment can't serve is out of date.
 */
export function isCurrentRecord(
  artworkId: string,
  record: PrintPresentationRecord,
  inputs: PresentationInputs | null,
): boolean {
  if (!inputs || record.fingerprint !== inputs.fingerprint) return false
  const here = presentationPublicUrls(artworkId, record.fingerprint)
  return record.urls.large === here.large && record.urls.small === here.small
}

/**
 * An artwork's presentation as it should be rendered now, with what it has stored — or null when
 * the artwork doesn't exist or gets no presentation (not an image, size unknown).
 */
export async function currentPresentation(
  artworkId: string,
): Promise<{ source: SourceRow; inputs: PresentationInputs } | null> {
  const [source] = await loadPresentationSources({ ids: [artworkId] })
  if (!source) return null
  const inputs = presentationInputs(source)
  return inputs ? { source, inputs } : null
}
