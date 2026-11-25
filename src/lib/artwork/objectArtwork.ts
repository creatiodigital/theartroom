/**
 * Objects: sculptures and other pieces with volume (artworkType 'object', docs/objects/README.md).
 *
 * An Object is a full artwork without the 3D room: a cover photo (the artwork's ordinary image),
 * photos and reels, details. It is NOT a print: no print sales, never in the print wizard, the
 * cart or checkout (owner, 2026-11-23) — `printEnabled` stays false, which every write route
 * enforces with `OBJECT_PRINT_OFF`.
 *
 * Client-safe: no Prisma import, so the editor can share the constants.
 */
import type {
  TObjectDisplayMode,
  TObjectMediaRole,
  TObjectModelStatus,
  TObjectPlacement,
} from '@/types/artwork'
import { sanitizeLine, sanitizeMultiline } from '@/utils/sanitizeLine'

export const isObjectArtwork = (type: string | null | undefined): boolean => type === 'object'

export const OBJECT_PLACEMENTS = [
  'indoors',
  'outdoors',
  'both',
] as const satisfies readonly TObjectPlacement[]
export const OBJECT_DISPLAY_MODES = [
  'floor',
  'pedestal',
  'wall',
  'hanging',
] as const satisfies readonly TObjectDisplayMode[]
export const OBJECT_MODEL_STATUSES = [
  'none',
  'ready',
] as const satisfies readonly TObjectModelStatus[]

/** The photo / video labels, in the editor's order, with the words the editor shows. */
export const OBJECT_MEDIA_ROLE_LABEL = {
  front: 'Front',
  back: 'Back',
  side: 'Side',
  detail: 'Detail',
  room: 'In a room',
  process: 'Process',
  reel: 'Reel',
} as const satisfies Record<TObjectMediaRole, string>

export const OBJECT_MEDIA_ROLES = Object.keys(OBJECT_MEDIA_ROLE_LABEL) as TObjectMediaRole[]

export const isObjectMediaRole = (value: unknown): value is TObjectMediaRole =>
  typeof value === 'string' && (OBJECT_MEDIA_ROLES as string[]).includes(value)

/**
 * What an Object's row always holds for print sales, written alongside every save of an Object:
 * the print gates (`isArtworkPurchasable`, `purchasableArtworkWhere`, checkout) all start from
 * `printEnabled`, so this alone keeps an Object out of the catalog, the wizard, the cart and
 * checkout.
 */
export const OBJECT_PRINT_OFF = {
  printEnabled: false,
  printPriceCents: null,
  editionType: 'open',
} as const

/**
 * The Object fields the artwork routes write (create, update, batch). The 3D model fields
 * (`modelUrl`, `modelStatus`, …) are not here on purpose: only the model routes (step O4) write
 * them, so no client can point an artwork at a file it did not upload.
 */
export type ObjectFieldsInput = {
  coverCropX?: number | null
  coverCropY?: number | null
  heightCm?: number | null
  widthCm?: number | null
  depthCm?: number | null
  weightKg?: number | null
  sizeIncludesBase?: boolean
  placement?: TObjectPlacement | null
  displayMode?: TObjectDisplayMode | null
  signedNote?: string | null
  certificateNote?: string | null
  careNote?: string | null
}

export type ParsedObjectFields =
  | { ok: true; data: ObjectFieldsInput }
  | { ok: false; error: string }

/** Largest size and weight accepted: far above any real piece, there only to refuse garbage. */
const MAX_SIZE_CM = 10_000
const MAX_WEIGHT_KG = 100_000
const MAX_NOTE_LINE = 300
const MAX_CARE_NOTE = 2_000

const SIZE_FIELDS = [
  ['heightCm', 'Height'],
  ['widthCm', 'Width'],
  ['depthCm', 'Depth'],
] as const

class FieldError extends Error {}

const isBlank = (value: unknown) => value === null || value === ''

/** A number from JSON or a form string ("12,5" too); throws on anything else. */
const toNumber = (value: unknown, label: string): number => {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim().replace(',', '.'))
        : NaN
  if (!Number.isFinite(n)) throw new FieldError(`${label} must be a number.`)
  return n
}

/** A positive amount on a grid (0.1 cm, 0.01 kg), or null to clear it. */
const toPositive = (value: unknown, label: string, max: number, step: number): number | null => {
  if (isBlank(value)) return null
  const rounded = Math.round(toNumber(value, label) / step) * step
  const n = Number(rounded.toFixed(2))
  if (n <= 0 || n > max) throw new FieldError(`${label} must be greater than 0 and at most ${max}.`)
  return n
}

/** A crop centre, 0..1. Clamped: the adjuster can overshoot by a pixel at an edge. */
const toCrop = (value: unknown, label: string): number | null => {
  if (isBlank(value)) return null
  return Math.min(1, Math.max(0, toNumber(value, label)))
}

const toChoice = <T extends string>(
  value: unknown,
  choices: readonly T[],
  label: string,
): T | null => {
  if (isBlank(value)) return null
  if (typeof value === 'string' && (choices as readonly string[]).includes(value)) return value as T
  throw new FieldError(`${label} must be one of: ${choices.join(', ')}.`)
}

const toNote = (value: unknown, label: string, multiline: boolean): string | null => {
  if (isBlank(value)) return null
  if (typeof value !== 'string') throw new FieldError(`${label} must be text.`)
  const clean = multiline ? sanitizeMultiline(value).trim() : sanitizeLine(value)
  const max = multiline ? MAX_CARE_NOTE : MAX_NOTE_LINE
  if (clean.length > max) throw new FieldError(`${label} is too long (at most ${max} characters).`)
  return clean || null
}

/**
 * The Object fields of a request body, validated and normalised. Only the keys the body carries
 * are returned (an absent key leaves the stored value as it is); `null` or '' clears a field.
 * Sizes are cm on the 0.1 cm grid every stored size uses; weight is kg to 10 g.
 *
 * "unique" (or clearing the edition) clears the edition numbers. Number N of M is checked when
 * both arrive together.
 */
export function parseObjectFields(body: Record<string, unknown>): ParsedObjectFields {
  const has = (key: string) => key in body && body[key] !== undefined
  const data: ObjectFieldsInput = {}
  try {
    if (has('coverCropX')) data.coverCropX = toCrop(body.coverCropX, 'Cover crop')
    if (has('coverCropY')) data.coverCropY = toCrop(body.coverCropY, 'Cover crop')
    for (const [key, label] of SIZE_FIELDS) {
      if (has(key)) data[key] = toPositive(body[key], label, MAX_SIZE_CM, 0.1)
    }
    if (has('weightKg')) data.weightKg = toPositive(body.weightKg, 'Weight', MAX_WEIGHT_KG, 0.01)
    if (has('sizeIncludesBase')) {
      data.sizeIncludesBase = body.sizeIncludesBase === true || body.sizeIncludesBase === 'true'
    }
    if (has('placement')) {
      data.placement = toChoice(body.placement, OBJECT_PLACEMENTS, 'Where it can stand')
    }
    if (has('displayMode')) {
      data.displayMode = toChoice(body.displayMode, OBJECT_DISPLAY_MODES, 'Display')
    }
    if (has('signedNote')) data.signedNote = toNote(body.signedNote, 'Signed', false)
    if (has('certificateNote')) {
      data.certificateNote = toNote(body.certificateNote, 'Certificate', false)
    }
    if (has('careNote')) data.careNote = toNote(body.careNote, 'Care and installation', true)
  } catch (error) {
    if (error instanceof FieldError) return { ok: false, error: error.message }
    throw error
  }
  return { ok: true, data }
}

/** 64 → "64", 64.5 → "64.5" (sizes are stored on the 0.1 cm grid). */
const writeCm = (cm: number) => String(Math.round(cm * 10) / 10)

/**
 * The legacy `dimensions` text of an Object, "64 × 38 × 31 cm" (H × W × D), kept so older
 * displays still show a size. Built from the sizes given, in that order; null when there are none.
 */
export function objectDimensionsText(size: {
  heightCm?: number | null
  widthCm?: number | null
  depthCm?: number | null
}): string | null {
  const parts = [size.heightCm, size.widthCm, size.depthCm].filter(
    (cm): cm is number => typeof cm === 'number' && cm > 0,
  )
  return parts.length ? `${parts.map(writeCm).join(' × ')} cm` : null
}

type StoredSize = {
  heightCm: number | null
  widthCm: number | null
  depthCm: number | null
}

/**
 * What an artwork route writes for an Object: the fields sent, print sales off, and — when a size
 * was sent — the `dimensions` text rebuilt from the full size (`stored` fills the sizes not sent;
 * null for a new row).
 */
export function objectWriteData(fields: ObjectFieldsInput, stored: StoredSize | null) {
  const sizeSent = 'heightCm' in fields || 'widthCm' in fields || 'depthCm' in fields
  const pick = (key: keyof StoredSize) => (key in fields ? fields[key] : stored?.[key])
  return {
    ...fields,
    ...OBJECT_PRINT_OFF,
    ...(sizeSent && {
      dimensions: objectDimensionsText({
        heightCm: pick('heightCm'),
        widthCm: pick('widthCm'),
        depthCm: pick('depthCm'),
      }),
    }),
  }
}

/** An Object's photos and videos, counted for its library row. */
export type ObjectMediaCounts = { photos: number; videos: number; reels: number }

/**
 * A reel is a vertical video (9:16) or one labelled Reel; any other video is a video. Photos are
 * the images (the cover is not one of them: it is the artwork's own image).
 */
export function countObjectMedia(
  items: readonly {
    kind: string
    role?: string | null
    width?: number | null
    height?: number | null
  }[],
): ObjectMediaCounts {
  const counts: ObjectMediaCounts = { photos: 0, videos: 0, reels: 0 }
  for (const item of items) {
    if (item.kind === 'image') counts.photos += 1
    if (item.kind !== 'video') continue
    const vertical = !!item.width && !!item.height && item.height > item.width
    if (item.role === 'reel' || vertical) counts.reels += 1
    else counts.videos += 1
  }
  return counts
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "8 photos · 2 reels", "5 photos · 1 video"; null when there is nothing. */
export function objectMediaSummary({ photos, videos, reels }: ObjectMediaCounts): string | null {
  const parts = [
    photos > 0 && plural(photos, 'photo', 'photos'),
    reels > 0 && plural(reels, 'reel', 'reels'),
    videos > 0 && plural(videos, 'video', 'videos'),
  ].filter((part): part is string => Boolean(part))
  return parts.length ? parts.join(' · ') : null
}

type CropCentre = { x?: number | null; y?: number | null }
type PixelSize = { width?: number | null; height?: number | null }

/**
 * The square crop of a cover: its side, as a fraction of the photo's width and height (the
 * largest square, so 1 on the short side), and its centre clamped so the square stays inside.
 */
export function coverSquare(crop: CropCentre, size: PixelSize) {
  const { width: w, height: h } = size
  const sx = w && h ? Math.min(w, h) / w : 1
  const sy = w && h ? Math.min(w, h) / h : 1
  const clamp = (c: number | null | undefined, side: number) =>
    Math.min(1 - side / 2, Math.max(side / 2, c ?? 0.5))
  return { sx, sy, x: clamp(crop.x, sx), y: clamp(crop.y, sy) }
}

/**
 * The CSS `object-position` that shows a cover's square crop in a square box with
 * `object-fit: cover` (grids, library rows, lists). The stored value is the square's centre;
 * CSS positions by the fraction of the overflow, hence the conversion. Without the photo's
 * size, the centre is used as is.
 */
export function coverObjectPosition(crop: CropCentre, size: PixelSize): string {
  if (!size.width || !size.height) return `${(crop.x ?? 0.5) * 100}% ${(crop.y ?? 0.5) * 100}%`
  const { sx, sy, x, y } = coverSquare(crop, size)
  const toPosition = (centre: number, side: number) =>
    side >= 1 ? 50 : ((centre - side / 2) / (1 - side)) * 100
  return `${toPosition(x, sx)}% ${toPosition(y, sy)}%`
}

// ── Visitor wording (docs/objects O5, objects-artwork-page-*.dc.html) ──────────

/** Details › Where it can stand. */
export const OBJECT_PLACEMENT_LABEL: Record<string, string> = {
  indoors: 'Indoors',
  outdoors: 'Outdoors',
  both: 'Indoors and outdoors',
}

/** Details › Display (the owner's word is "pedestal", docs/objects). */
export const OBJECT_DISPLAY_LABEL: Record<string, string> = {
  floor: 'On the floor',
  pedestal: 'On a pedestal',
  wall: 'On a wall',
  hanging: 'Hanging',
}

/**
 * What a grid card needs to show an Object (docs/objects O5): its cover cropped square at the
 * artist's crop. Null for every other type, so the card shows the work as always.
 */
export function objectCardOf(row: {
  artworkType?: string | null
  coverCropX?: number | null
  coverCropY?: number | null
  originalWidth?: number | null
  originalHeight?: number | null
}): { coverPosition: string } | null {
  if (row.artworkType !== 'object') return null
  return {
    coverPosition: coverObjectPosition(
      { x: row.coverCropX, y: row.coverCropY },
      { width: row.originalWidth, height: row.originalHeight },
    ),
  }
}
