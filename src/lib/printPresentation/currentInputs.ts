import { presentationFingerprint, presentationInputs, type PresentationInputs } from './inputs'
import { loadPresentationSources, type SourceRow } from './loadSources'
import { PRESENTATION_FRAMES, frameOf, type PresentationFrame } from './look'
import type { PrintPresentationRecord } from './record'
import { presentationPublicUrls } from './storage'

/**
 * Whether this deployment serves a stored render's files. Local renders (development) and staging
 * share one database; a record whose files live on the other backend can't be shown here. Nor one
 * whose fingerprint couldn't name a file — one bad record mustn't take every page's renders down.
 */
const servedHere = (artworkId: string, record: PrintPresentationRecord) => {
  try {
    const here = presentationPublicUrls(artworkId, record.fingerprint)
    return record.urls.large === here.large && record.urls.small === here.small
  } catch {
    return false
  }
}

/**
 * Whether a stored render still fits the work AND lives where this deployment serves renders: its
 * fingerprint is the current one and its URLs are this backend's. Anything else is out of date.
 */
export function isCurrentRecord(
  artworkId: string,
  record: PrintPresentationRecord,
  inputs: PresentationInputs | null,
): boolean {
  return !!inputs && record.fingerprint === inputs.fingerprint && servedHere(artworkId, record)
}

/** How far a render's image shape may be from the work's before its window no longer fits. */
const SHAPE_TOLERANCE = 0.005

/**
 * The stored render a public page shows, and the shot it is (its frame, or null for the bare
 * sheet, and its image's shape) — or null for the plain image.
 *
 * An out-of-date render stays up until it's re-rendered (owner, 2026-11-03: the works "won't go
 * back to the raw default image, but to the latest rendered version"; they update them little by
 * little): a new frame, a passepartout, a new look. Not when it would show the work wrongly: its
 * image changed shape (the original would no longer fill the window) or its edition changed (a
 * wrong pencilled number). Never a render this deployment can't serve.
 */
export function shownRecord(
  artworkId: string,
  record: PrintPresentationRecord,
  inputs: PresentationInputs | null,
): { frame: PresentationFrame | null; ratio: number } | null {
  if (!inputs || !servedHere(artworkId, record)) return null
  if (record.fingerprint === inputs.fingerprint) return { frame: inputs.frame, ratio: inputs.ratio }
  if (record.mode !== inputs.mode || record.edition !== inputs.edition) return null
  if (record.frame === undefined || record.ratio === undefined) {
    const frame = legacyFrame(record, inputs)
    return frame === undefined ? null : { frame, ratio: inputs.ratio }
  }
  if (Math.abs(record.ratio / inputs.ratio - 1) > SHAPE_TOLERANCE) return null
  return { frame: frameOf(record.frame), ratio: record.ratio }
}

/**
 * The frame an out-of-date render saved before 2026-11-03 was shot in (null: the bare sheet), when
 * it can be told for sure: the one whose fingerprint, everything else as the work is now (shape,
 * edition, look), is the render's. Undefined when none is — another look, another shape — and the
 * render then isn't shown, as before: never placed as a shot it might not be.
 */
function legacyFrame(
  record: PrintPresentationRecord,
  inputs: PresentationInputs,
): PresentationFrame | null | undefined {
  const frames: (PresentationFrame | null)[] = [...PRESENTATION_FRAMES, null]
  const index = frames.findIndex(
    (frame) =>
      presentationFingerprint({ ...inputs, frame, passepartout: false }) === record.fingerprint,
  )
  return index === -1 ? undefined : frames[index]
}

/**
 * A current render's record with what its shot shows written into it — for a render saved before
 * 2026-11-03, which doesn't say. Written before the work's frame or passepartout changes, so the
 * render, out of date from then on, is still placed as the shot it is — even after a later change
 * of look, which `legacyFrame` couldn't see through. Null when there's nothing to add.
 */
export function shotFacts(
  artworkId: string,
  record: PrintPresentationRecord | null,
  inputs: PresentationInputs | null,
): PrintPresentationRecord | null {
  if (!record || !inputs || record.frame !== undefined) return null
  if (!isCurrentRecord(artworkId, record, inputs)) return null
  return {
    ...record,
    frame: inputs.frame ?? 'none',
    passepartout: inputs.passepartout,
    ratio: inputs.ratio,
  }
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
