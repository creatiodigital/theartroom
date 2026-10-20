import { createHash } from 'node:crypto'

import { BAKER_VERSION } from './bakeRecord'
import { canonicalJson } from './hash'

/**
 * The exhibition columns that change how the room is lit — only what an artist may still
 * change. The space owns the rest (lamp colors, angles, floor, window light…) and the
 * renderer ignores those columns, so they must not stale a bake.
 */
export const LIGHT_FIELDS: readonly string[] = [
  'spaceId',
  'wallColor',
  'ceilingLightMode',
  'trackLampIntensity',
  'recessedLampIntensity',
  'trackLampsVisible',
  'trackLampSettings',
  'panelSettings',
  'windowFrameColor',
  'radiatorColor',
]

// Placed-row columns that never touch the light: page membership and playback.
const PLACED_IGNORED = new Set([
  'id',
  'exhibitionId',
  'createdAt',
  'updatedAt',
  'showOnPage',
  'pageOrder',
  'sectionId',
  'videoPlayMode',
  'videoLoop',
  'videoVolume',
  'videoProximityDistance',
  'soundPlayMode',
  'soundSpatial',
  'soundDistance',
])

export interface BakeFingerprintInput {
  exhibition: Record<string, unknown>
  placed: Record<string, unknown>[]
  spaceModelVersion: string
  spaceLookVersion: string
}

function reducePlaced(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (PLACED_IGNORED.has(key)) continue
    if (key === 'artwork') {
      const a = (value ?? {}) as Record<string, unknown>
      out.artwork = { artworkType: a.artworkType, hiddenFromExhibition: a.hiddenFromExhibition }
    } else {
      out[key] = value
    }
  }
  return out
}

/** sha256 hex of everything that decides how the room is lit. */
export function computeBakeFingerprint(input: BakeFingerprintInput): string {
  const exhibition: Record<string, unknown> = {}
  for (const field of LIGHT_FIELDS) exhibition[field] = input.exhibition[field] ?? null

  const placed = input.placed
    .map(reducePlaced)
    .sort((a, b) => String(a.artworkId).localeCompare(String(b.artworkId)))

  return createHash('sha256')
    .update(
      canonicalJson({
        bakerVersion: BAKER_VERSION,
        spaceModelVersion: input.spaceModelVersion,
        spaceLookVersion: input.spaceLookVersion,
        exhibition,
        placed,
      }),
    )
    .digest('hex')
}
