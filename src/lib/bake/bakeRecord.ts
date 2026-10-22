// Bump whenever bake or display code changes the result. 2: text cards are baked (AR-163).
export const BAKER_VERSION = 2

export type BakeSurface = 'wall' | 'ceiling' | 'floor' | 'props' | 'panels' | 'cards'
/**
 * The receivers a stored bake carries maps for (the artwork atlas is measured only). `panels`:
 * the display panels, baked since 2026-10-21; `cards`: the text cards, since 2026-10-22 (AR-163)
 * — a bake from before has no map for them.
 */
export const BAKE_SURFACES: readonly BakeSurface[] = [
  'wall',
  'ceiling',
  'floor',
  'props',
  'panels',
  'cards',
]
export type BakeMapKind = 'light' | 'direction'

export interface LightmapEncoding {
  format: 'log16' | 'signed16'
  max: number
  knee: number
}

export interface BakeMap {
  receiver: BakeSurface
  kind: BakeMapKind
  url: string
  width: number
  height: number
  encoding: LightmapEncoding
}

export interface BakeRecord {
  id: string
  fingerprint: string
  bakerVersion: number
  unwrapHash: string
  /**
   * `unwrapStats` of the same `uv1` arrays as `unwrapHash` — `[count, Σu, Σv, Σk·u, Σk·v]` each —
   * so a browser that computes the unwrap one ulp apart can still accept the maps.
   */
  unwrapStats: number[][]
  maps: BakeMap[]
  /** The space's fixed camera at bake time. */
  camera: { exposure: number; whiteBalance: [number, number, number] }
  /**
   * Artwork id → the daylight + bounce the bake measured at that work's image (linear RGB
   * irradiance, three units): its mat, frame and text card are lit with it.
   */
  artLight: Record<string, [number, number, number]>
  bakedAt: string
  bakedBy: string
  ms: number
  /** Set when the admin opened the review view on this exact bake. */
  reviewedAt: string | null
}

/** What the admin's bake page sends: the server adds who baked it and clears `reviewedAt`. */
export type BakeDraft = Omit<BakeRecord, 'bakedBy' | 'reviewedAt'>

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

const isEncoding = (v: unknown): boolean =>
  isObject(v) && (v.format === 'log16' || v.format === 'signed16') && isNum(v.max) && isNum(v.knee)

const isNumbers = (v: unknown, length: number): boolean =>
  Array.isArray(v) && v.length === length && v.every(isNum)

const isMap = (v: unknown): boolean =>
  isObject(v) &&
  (v.receiver === 'wall' ||
    v.receiver === 'ceiling' ||
    v.receiver === 'floor' ||
    v.receiver === 'props' ||
    v.receiver === 'panels' ||
    v.receiver === 'cards') &&
  (v.kind === 'light' || v.kind === 'direction') &&
  isStr(v.url) &&
  isNum(v.width) &&
  isNum(v.height) &&
  isEncoding(v.encoding)

export function isBakeRecord(value: unknown): value is BakeRecord {
  if (!isObject(value)) return false
  const cam = value.camera
  return (
    isStr(value.id) &&
    isStr(value.fingerprint) &&
    isNum(value.bakerVersion) &&
    isStr(value.unwrapHash) &&
    Array.isArray(value.unwrapStats) &&
    value.unwrapStats.every((stat) => isNumbers(stat, 5)) &&
    Array.isArray(value.maps) &&
    value.maps.every(isMap) &&
    isObject(cam) &&
    isNum(cam.exposure) &&
    Array.isArray(cam.whiteBalance) &&
    cam.whiteBalance.length === 3 &&
    cam.whiteBalance.every(isNum) &&
    isObject(value.artLight) &&
    !Array.isArray(value.artLight) &&
    Object.values(value.artLight).every((light) => isNumbers(light, 3)) &&
    isStr(value.bakedAt) &&
    isStr(value.bakedBy) &&
    isNum(value.ms) &&
    (value.reviewedAt === null || isStr(value.reviewedAt))
  )
}
