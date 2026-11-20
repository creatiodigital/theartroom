import { canonicalJson, fnv1a } from '@/lib/bake/hash'
import { computeSheetLayout, isFixedSheet } from '@/lib/editions/sheetLayout'
import { getPrintLongEdgeBounds } from '@/lib/print-providers/printspace/sizeBounds'

import type { PresentationInputs } from './inputs'
import type { SourceRow } from './loadSources'

/**
 * What a work's three photo views depend on (see
 * docs/superpowers/specs/2026-11-20-print-photo-views-design.md). Unlike the framed presentation,
 * the artwork IS in these renders, so the work's image is part of their fingerprint; the copy they
 * pencil is NOT (a sale keeps them showing, one copy behind, until the owner re-renders).
 */

/** Bump when the photos' look changes: every work's photos then read as out of date. */
// 2: the unframed sheet is sharp front to back (owner, 2026-11-20).
export const PHOTO_LOOK_VERSION = 2

/** The printed sheet, in centimetres: the image and the paper's margin on each side. */
export type PhotoSheet = {
  imageW: number
  imageH: number
  left: number
  right: number
  top: number
  bottom: number
}

/** Open editions (and works without a print size): a typical gallery print. */
const OPEN_LONG_CM = 50
const OPEN_MARGIN_CM = 5
/** Below this bottom margin there's no room under the image for a pencilled number. */
export const MIN_NUMBER_MARGIN_CM = 1.6

const cm = (v: number) => Math.round(v * 100) / 100

/**
 * The sheet a work's photos show, at its real print size: the mandatory size of a limited edition
 * (a fixed sheet laid out as the lab does, or the print with its border all round); otherwise a
 * 50 cm print with a 5 cm margin, within what the file can print.
 */
export function photoSheet(source: SourceRow, ratio: number): PhotoSheet {
  const size = source.mandatorySize
  if (size) {
    const layout = isFixedSheet(size)
      ? computeSheetLayout({
          sheetWidthCm: size.sheetWidthCm!,
          sheetHeightCm: size.sheetHeightCm!,
          minBorderCm: size.borderCm,
          aspectRatio: ratio,
        })
      : null
    if (layout) {
      return {
        imageW: cm(layout.imageWidthCm),
        imageH: cm(layout.imageHeightCm),
        left: cm(layout.borderXCm),
        right: cm(layout.borderXCm),
        top: cm(layout.borderYCm),
        bottom: cm(layout.borderYCm),
      }
    }
    const b = cm(size.borderCm)
    return { imageW: cm(size.widthCm), imageH: cm(size.heightCm), left: b, right: b, top: b, bottom: b }
  }
  const bounds =
    source.originalWidth && source.originalHeight
      ? getPrintLongEdgeBounds({ width: source.originalWidth, height: source.originalHeight })
      : null
  const long = bounds
    ? Math.min(Math.max(OPEN_LONG_CM, bounds.minLongCm), bounds.maxLongCm)
    : OPEN_LONG_CM
  return {
    imageW: cm(ratio >= 1 ? long : long * ratio),
    imageH: cm(ratio >= 1 ? long / ratio : long),
    left: OPEN_MARGIN_CM,
    right: OPEN_MARGIN_CM,
    top: OPEN_MARGIN_CM,
    bottom: OPEN_MARGIN_CM,
  }
}

/**
 * The copy a render pencils (owner, 2026-11-20: "the real current number"): the next unsold copy
 * of the mandatory size; `edition` (N/N) when every copy is sold; 1 before its copies exist (they're
 * created when the size is published).
 */
export function pencilledCopy(source: SourceRow, edition: number): number {
  if (source.nextCopy !== null) return source.nextCopy
  return source.hasCopies ? edition : 1
}

/**
 * The copy a render pencils — the framed view's number and, when there's room, the photos' — or
 * null for works that carry none (open editions, works not for sale).
 */
export function renderCopy(source: SourceRow, inputs: PresentationInputs | null): number | null {
  if (!inputs || inputs.mode !== 'limited' || inputs.edition === null) return null
  return pencilledCopy(source, inputs.edition)
}

export type PhotoInputs = {
  sheet: PhotoSheet
  /** A number is pencilled: a limited edition with room for it under the image. */
  numbered: boolean
  /** N, when numbered. */
  edition: number | null
  /** The copy pencilled now, when numbered (not in the fingerprint). */
  copy: number | null
  imageUrl: string
  seed: number
  fingerprint: string
}

/** What the photos' look depends on: the image, the sheet, the work's seed, whether and N. */
export function photoViewsFingerprint(p: Omit<PhotoInputs, 'fingerprint' | 'copy'>): string {
  return fnv1a(
    canonicalJson([PHOTO_LOOK_VERSION, p.seed, p.sheet, p.numbered, p.edition, p.imageUrl]),
  )
}

/** A work's photo inputs, or null when it gets no photos (no presentation, or no web image). */
export function photoInputs(
  source: SourceRow,
  inputs: PresentationInputs | null,
): PhotoInputs | null {
  if (!inputs || !source.imageUrl) return null
  const sheet = photoSheet(source, inputs.ratio)
  const numbered =
    inputs.mode === 'limited' && inputs.edition !== null && sheet.bottom >= MIN_NUMBER_MARGIN_CM
  const edition = numbered ? inputs.edition : null
  const base = { sheet, numbered, edition, imageUrl: source.imageUrl, seed: inputs.seed }
  return {
    ...base,
    copy: numbered ? pencilledCopy(source, edition!) : null,
    fingerprint: photoViewsFingerprint(base),
  }
}
