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
import type { TObjectMediaRole, TObjectModelStatus } from '@/types/artwork'

export const isObjectArtwork = (type: string | null | undefined): boolean => type === 'object'

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
  heightCm?: number | null
  widthCm?: number | null
  depthCm?: number | null
  weightKg?: number | null
}

export type ParsedObjectFields =
  | { ok: true; data: ObjectFieldsInput }
  | { ok: false; error: string }

/** Largest size and weight accepted: far above any real piece, there only to refuse garbage. */
const MAX_SIZE_CM = 10_000
const MAX_WEIGHT_KG = 100_000

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
    for (const [key, label] of SIZE_FIELDS) {
      if (has(key)) data[key] = toPositive(body[key], label, MAX_SIZE_CM, 0.1)
    }
    if (has('weightKg')) data.weightKg = toPositive(body.weightKg, 'Weight', MAX_WEIGHT_KG, 0.01)
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

// ── Visitor wording (docs/objects O5, objects-artwork-page-*.dc.html) ──────────
