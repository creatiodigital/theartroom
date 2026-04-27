/**
 * Prodigi-typed config: the strongly-typed shape used by Prodigi's own
 * downstream code (SKU resolution, order creation, payment intent).
 *
 * The wizard works with the canonical `WizardConfig` (`{ values, … }`).
 * Adapter helpers below convert between the two so external consumers
 * can keep using the typed shape they always have.
 */
import type { WizardConfig } from '../types'
import {
  PRODIGI_FORMATS,
  PRODIGI_FRAME_COLORS,
  PRODIGI_MOUNTS,
  PRODIGI_PAPERS,
  PRODIGI_SIZES,
  type ProdigiFormat,
  type ProdigiFrameColor,
  type ProdigiMount,
  type ProdigiPaper,
  type ProdigiSize,
} from './data'

export type PaperId = ProdigiPaper['id']
export type FormatId = ProdigiFormat['id']
export type FrameColorId = ProdigiFrameColor['id']
export type MountId = ProdigiMount['id']
export type SizeId = ProdigiSize['id']
export type Orientation = 'portrait' | 'landscape'

/** Strongly-typed config for Prodigi's downstream consumers. */
export type ProdigiConfig = {
  paperId: PaperId
  formatId: FormatId
  sizeId: SizeId
  frameColorId: FrameColorId
  mountId: MountId
  orientation: Orientation
}

/**
 * Artist-controlled restriction allow-lists, scoped to Prodigi's
 * dimensions. Empty / missing field = no restriction. Stored on
 * `Artwork.printOptions` as JSON. Kept in the typed Prodigi shape (not
 * the generic `PrintRestrictions`) so the existing external consumers
 * (admin, payment intent, artist UI) keep working without changes.
 */
export type PrintOptions = {
  allowedPaperIds?: PaperId[]
  allowedFormatIds?: FormatId[]
  allowedSizeIds?: SizeId[]
  allowedFrameColorIds?: FrameColorId[]
  allowedMountIds?: MountId[]
}

// ── Lookups ──────────────────────────────────────────────────────

function resolve<T extends { id: string }>(list: T[], id: string, kind: string): T {
  const found = list.find((x) => x.id === id)
  if (found) return found
  const fallback = list[0]
  if (!fallback) throw new Error(`[Prodigi] Empty catalog for ${kind}`)
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[Prodigi] Unknown ${kind} id "${id}" — falling back to "${fallback.id}"`)
  }
  return fallback
}

export const getProdigiPaper = (id: string) => resolve(PRODIGI_PAPERS, id, 'paper')
export const getProdigiFormat = (id: string) => resolve(PRODIGI_FORMATS, id, 'format')
export const getProdigiFrameColor = (id: string) => resolve(PRODIGI_FRAME_COLORS, id, 'frame color')
export const getProdigiMount = (id: string) => resolve(PRODIGI_MOUNTS, id, 'mount')
export const getProdigiSize = (id: string) => resolve(PRODIGI_SIZES, id, 'size')

// ── Conversion: canonical WizardConfig ⇄ ProdigiConfig ────────────

/**
 * Read a strongly-typed Prodigi config out of the wizard's generic
 * `WizardConfig`. Sanitizes unknown ids to the first known value so
 * downstream code never sees garbage.
 */
export function configToProdigi(config: WizardConfig): ProdigiConfig {
  const v = config.values
  return normalizeProdigiConfig({
    paperId: (v.paper ?? PRODIGI_PAPERS[0].id) as PaperId,
    formatId: (v.format ?? PRODIGI_FORMATS[0].id) as FormatId,
    sizeId: (v.size ?? PRODIGI_SIZES[PRODIGI_SIZES.length - 1].id) as SizeId,
    frameColorId: (v.color ?? PRODIGI_FRAME_COLORS[0].id) as FrameColorId,
    mountId: (v.mount ?? PRODIGI_MOUNTS[0].id) as MountId,
    orientation: (v.orientation === 'landscape' ? 'landscape' : 'portrait') as Orientation,
  })
}

/** Write a Prodigi config back into the wizard's generic shape. */
export function prodigiToConfig(c: ProdigiConfig): WizardConfig {
  return {
    values: {
      paper: c.paperId,
      format: c.formatId,
      size: c.sizeId,
      color: c.frameColorId,
      mount: c.mountId,
      orientation: c.orientation,
    },
  }
}

/** Repair stale/invalid ids. Safe to call after every state change. */
export function normalizeProdigiConfig(config: ProdigiConfig): ProdigiConfig {
  const paperId = PRODIGI_PAPERS.find((p) => p.id === config.paperId)?.id ?? PRODIGI_PAPERS[0].id
  const formatId =
    PRODIGI_FORMATS.find((f) => f.id === config.formatId)?.id ?? PRODIGI_FORMATS[0].id
  const sizeId =
    PRODIGI_SIZES.find((s) => s.id === config.sizeId)?.id ??
    PRODIGI_SIZES[PRODIGI_SIZES.length - 1].id
  const frameColorId =
    PRODIGI_FRAME_COLORS.find((c) => c.id === config.frameColorId)?.id ?? PRODIGI_FRAME_COLORS[0].id
  const mountId = PRODIGI_MOUNTS.find((m) => m.id === config.mountId)?.id ?? PRODIGI_MOUNTS[0].id
  const orientation: Orientation = config.orientation === 'landscape' ? 'landscape' : 'portrait'
  return { paperId, formatId, sizeId, frameColorId, mountId, orientation }
}

/** Portrait when the image is taller than wide; landscape otherwise. */
export function deriveOrientation(aspectRatio: number): Orientation {
  return aspectRatio < 1 ? 'portrait' : 'landscape'
}
