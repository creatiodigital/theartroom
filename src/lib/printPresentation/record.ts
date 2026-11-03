import type { PresentationWindow } from './geometry'
import { isFrameChoice, type FrameChoice, type PresentationMode } from './look'

/** The two stored sizes: the artwork page's, and the grids'. */
export type PresentationSize = 'large' | 'small'

/** Width in pixels of each stored size (both cut from one render, so one window fits both). */
export const PRESENTATION_WIDTH_PX = { large: 1800, small: 900 } as const

/**
 * `Artwork.printPresentation`: a stored render of the artwork's surround (frame or sheet, wall,
 * shadows) with a transparent window where the original image goes. Built by the server when the
 * admin's browser saves a render; never sent by a client.
 */
export type PrintPresentationRecord = {
  /** `presentationInputs(...).fingerprint` at render time; out of date once it no longer matches. */
  fingerprint: string
  mode: PresentationMode
  edition: number | null
  /** Where the artwork's window is in the shot, as fractions of its width and height. */
  window: PresentationWindow
  /** The shot's width over its height, so pages can size it before it loads. */
  aspect: number
  urls: Record<PresentationSize, string>
  renderedAt: string
  /**
   * What the shot shows, so a page can still place it once the work's settings have moved on (a
   * render stays up until it's re-rendered): the frame it was shot in, whether it held a
   * passepartout, and the image's shape. Absent on renders saved before 2026-11-03.
   */
  frame?: FrameChoice
  passepartout?: boolean
  ratio?: number
}

const fraction = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1

export const isPresentationWindow = (w: unknown): w is PresentationWindow => {
  if (!w || typeof w !== 'object') return false
  const { x, y, w: width, h } = w as Record<string, unknown>
  return fraction(x) && fraction(y) && fraction(width) && fraction(h)
}

export function isPrintPresentationRecord(x: unknown): x is PrintPresentationRecord {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  const urls = r.urls as Record<string, unknown> | undefined
  return (
    typeof r.fingerprint === 'string' &&
    (r.mode === 'framed' || r.mode === 'limited') &&
    (r.edition === null || (typeof r.edition === 'number' && r.edition > 0)) &&
    isPresentationWindow(r.window) &&
    typeof r.aspect === 'number' &&
    Number.isFinite(r.aspect) &&
    r.aspect > 0 &&
    !!urls &&
    typeof urls.large === 'string' &&
    typeof urls.small === 'string' &&
    typeof r.renderedAt === 'string' &&
    (r.frame === undefined || isFrameChoice(r.frame)) &&
    (r.passepartout === undefined || typeof r.passepartout === 'boolean') &&
    (r.ratio === undefined ||
      (typeof r.ratio === 'number' && Number.isFinite(r.ratio) && r.ratio > 0))
  )
}

/** What a page needs to show a presentation: both files, the window, and the shot's shape. */
export type PresentationView = {
  window: PresentationWindow
  aspect: number
  large: string
  small: string
  /** The piece with a thin border of wall, for a page that crops the shot to it (`pieceArea`). */
  piece?: PresentationWindow
}

export const presentationView = (record: PrintPresentationRecord): PresentationView => ({
  window: record.window,
  aspect: record.aspect,
  large: record.urls.large,
  small: record.urls.small,
})
