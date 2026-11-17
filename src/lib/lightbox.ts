/**
 * AR-183 Lightbox (docs/lightbox/README.md): a way to present an IMAGE artwork in the 3D room, like
 * Frame or Passepartout. The image sits in a shallow box and is lit from behind. Per exhibition
 * (ExhibitionArtwork) and in presets (ArtworkPreset); the artwork page, prints and the print flow
 * never read these.
 *
 * One place for the values, so the panel, the save, the API checks, the mapper and the room agree.
 */

export const LIGHTBOX_LIGHTS = ['warm', 'neutral', 'cool'] as const
export type TLightboxLight = (typeof LIGHTBOX_LIGHTS)[number]

export const LIGHTBOX_EDGES = ['none', 'thin', 'wide'] as const
export type TLightboxEdge = (typeof LIGHTBOX_EDGES)[number]

export const LIGHTBOX_MATERIALS = ['alu-black', 'alu-silver', 'white', 'oak', 'walnut'] as const
export type TLightboxMaterial = (typeof LIGHTBOX_MATERIALS)[number]

export const LIGHTBOX_FRONTS = ['matte', 'glossy'] as const
export type TLightboxFront = (typeof LIGHTBOX_FRONTS)[number]

/** Brightness 0..1 (the panel's Soft..Bright); depth in cm. */
export const LIGHTBOX_BRIGHTNESS = { min: 0, max: 1 } as const
export const LIGHTBOX_DEPTH = { min: 3, max: 15 } as const

/** The front border around the image, cm. */
export const LIGHTBOX_EDGE_CM: Record<TLightboxEdge, number> = { none: 0, thin: 1.5, wide: 4 }

/** Color temperature of each light, kelvin (≈3000 / 4000 / 6500 K). */
export const LIGHTBOX_LIGHT_KELVIN: Record<TLightboxLight, number> = {
  warm: 3000,
  neutral: 4000,
  cool: 6500,
}

/**
 * Each material's swatch (designs/lightbox.dc.html): the Look card's tiles and, for the metals and
 * white, the box's edge on the 2D wall (oak and walnut show the frame's wood there).
 */
export const LIGHTBOX_SWATCH: Record<TLightboxMaterial, string> = {
  'alu-black': 'linear-gradient(135deg, #2a2a2a, #111)',
  'alu-silver': 'linear-gradient(135deg, #e3e3e3, #a9a9a9)',
  white: '#f7f7f5',
  oak: 'linear-gradient(135deg, #c9a77c, #a7835a)',
  walnut: 'linear-gradient(135deg, #6e4b33, #4a3020)',
}

export type TLightbox = {
  showLightbox: boolean
  lightboxBrightness: number
  lightboxLight: TLightboxLight
  lightboxDepth: number
  lightboxEdge: TLightboxEdge
  lightboxMaterial: TLightboxMaterial
  lightboxFront: TLightboxFront
}

export const LIGHTBOX_DEFAULTS: TLightbox = {
  showLightbox: false,
  lightboxBrightness: 0.55,
  lightboxLight: 'neutral',
  lightboxDepth: 6,
  lightboxEdge: 'thin',
  lightboxMaterial: 'alu-black',
  // Tuning round 2 (owner, 2026-11-16): a glossy front's soft sheen is the strongest sign of a
  // lightbox; Matte stays a choice.
  lightboxFront: 'glossy',
}

/** The seven columns, in schema order. */
export const LIGHTBOX_FIELDS = Object.keys(LIGHTBOX_DEFAULTS) as (keyof TLightbox)[]

/**
 * How a bake lights the room with a lightbox (its emitter's calibration). Raised when that changes:
 * a bake made with the old light is out of date (`fingerprint.ts`) and its fronts no longer count
 * as baked (`lightboxBakeKey`). 2: tuning round 1 (2026-11-15), the panel at 10–20× a lit wall.
 */
export const LIGHTBOX_LIGHT_VERSION = 2

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value)

const inRange = (value: unknown, range: { min: number; max: number }): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= range.min && value <= range.max

/**
 * The lightbox settings of a row, a preset or a client artwork, each one valid. Anything missing
 * or unknown (a snapshot published before AR-183, a hand-edited row) reads as its default.
 */
export function readLightbox(
  source: Partial<Record<keyof TLightbox, unknown>> | null | undefined,
): TLightbox {
  const s = source ?? {}
  return {
    showLightbox: s.showLightbox === true,
    lightboxBrightness: inRange(s.lightboxBrightness, LIGHTBOX_BRIGHTNESS)
      ? s.lightboxBrightness
      : LIGHTBOX_DEFAULTS.lightboxBrightness,
    lightboxLight: isOneOf(LIGHTBOX_LIGHTS, s.lightboxLight)
      ? s.lightboxLight
      : LIGHTBOX_DEFAULTS.lightboxLight,
    lightboxDepth: inRange(s.lightboxDepth, LIGHTBOX_DEPTH)
      ? s.lightboxDepth
      : LIGHTBOX_DEFAULTS.lightboxDepth,
    lightboxEdge: isOneOf(LIGHTBOX_EDGES, s.lightboxEdge)
      ? s.lightboxEdge
      : LIGHTBOX_DEFAULTS.lightboxEdge,
    lightboxMaterial: isOneOf(LIGHTBOX_MATERIALS, s.lightboxMaterial)
      ? s.lightboxMaterial
      : LIGHTBOX_DEFAULTS.lightboxMaterial,
    lightboxFront: isOneOf(LIGHTBOX_FRONTS, s.lightboxFront)
      ? s.lightboxFront
      : LIGHTBOX_DEFAULTS.lightboxFront,
  }
}

/** Whether a client artwork is shown as a lightbox in the room (image artworks only). */
export const isLightbox = (artwork: {
  showLightbox?: boolean
  artworkType?: string | null
}): boolean => artwork.showLightbox === true && (artwork.artworkType ?? 'image') === 'image'

/**
 * Server-side check of the lightbox fields in a request body. A field left out is fine (the
 * caller keeps or defaults it); a field sent must be valid. `artworkType` is the work's (or the
 * preset's) type: only an image may be a lightbox. Returns the problem, or null.
 */
export function lightboxFieldsError(
  body: Record<string, unknown>,
  artworkType: string | null | undefined,
): string | null {
  const has = (key: keyof TLightbox) => body[key] !== undefined && body[key] !== null

  if (has('showLightbox') && typeof body.showLightbox !== 'boolean')
    return 'showLightbox must be true or false'
  if (body.showLightbox === true && artworkType !== 'image')
    return 'Only an image artwork can be shown as a lightbox'
  if (has('lightboxBrightness') && !inRange(body.lightboxBrightness, LIGHTBOX_BRIGHTNESS))
    return `lightboxBrightness must be a number from ${LIGHTBOX_BRIGHTNESS.min} to ${LIGHTBOX_BRIGHTNESS.max}`
  if (has('lightboxLight') && !isOneOf(LIGHTBOX_LIGHTS, body.lightboxLight))
    return `lightboxLight must be one of ${LIGHTBOX_LIGHTS.join(', ')}`
  if (has('lightboxDepth') && !inRange(body.lightboxDepth, LIGHTBOX_DEPTH))
    return `lightboxDepth must be a number of cm from ${LIGHTBOX_DEPTH.min} to ${LIGHTBOX_DEPTH.max}`
  if (has('lightboxEdge') && !isOneOf(LIGHTBOX_EDGES, body.lightboxEdge))
    return `lightboxEdge must be one of ${LIGHTBOX_EDGES.join(', ')}`
  if (has('lightboxMaterial') && !isOneOf(LIGHTBOX_MATERIALS, body.lightboxMaterial))
    return `lightboxMaterial must be one of ${LIGHTBOX_MATERIALS.join(', ')}`
  if (has('lightboxFront') && !isOneOf(LIGHTBOX_FRONTS, body.lightboxFront))
    return `lightboxFront must be one of ${LIGHTBOX_FRONTS.join(', ')}`
  return null
}

/** The lightbox fields of a valid request body, for a create (absent = default). */
export const lightboxCreateData = (body: Record<string, unknown>): TLightbox => readLightbox(body)

/** The lightbox fields of a valid request body, for an update (absent = keep). */
export function lightboxUpdateData(body: Record<string, unknown>): Partial<TLightbox> {
  const out: Partial<TLightbox> = {}
  const read = readLightbox(body)
  for (const key of LIGHTBOX_FIELDS) {
    if (body[key] !== undefined && body[key] !== null) {
      ;(out as Record<string, unknown>)[key] = read[key]
    }
  }
  return out
}
