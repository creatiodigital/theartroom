import { createHash } from 'node:crypto'

import { BAKER_VERSION } from './bakeRecord'
import { canonicalJson } from './hash'

/**
 * The exhibition columns that change how the room is lit — only what an artist may still
 * change. The space owns the rest (lamp colors, the recessed lamps' angles, floor, window
 * light…) and the renderer ignores those columns, so they must not stale a bake.
 */
export const LIGHT_FIELDS: readonly string[] = [
  'spaceId',
  'wallColor',
  'ceilingColor',
  'ceilingLightMode',
  'trackLampIntensity',
  'trackLampAngle',
  'trackLampDistance',
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

/**
 * Display panels are baked since AR-163 (2026-10-21); before, they kept realtime light. A room
 * that shows a panel says so, so its bakes from before are out of date; a room without one keeps
 * its fingerprint, and its bake.
 */
const PANELS_BAKED = 1

/** Any panel switched on (`isPanelEnabled`: `enabled` true, off by default). */
const showsPanels = (panelSettings: unknown): boolean =>
  !!panelSettings &&
  typeof panelSettings === 'object' &&
  Object.values(panelSettings as Record<string, unknown>).some(
    (p) => !!p && typeof p === 'object' && (p as { enabled?: unknown }).enabled === true,
  )

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

/**
 * Gallery benches (AR-167) stand in the bake: they shadow the floor and the walls. Only the benches
 * switched on count, so a room without one keeps its fingerprint and its bake. `benchSettings` is
 * deliberately not in LIGHT_FIELDS: an absent field hashes there as null, which would stale every
 * bake ever made.
 */
const shownBenches = (benchSettings: unknown): Record<string, unknown> | null => {
  if (!benchSettings || typeof benchSettings !== 'object') return null
  const shown = Object.fromEntries(
    Object.entries(benchSettings as Record<string, unknown>).filter(
      ([, b]) => !!b && typeof b === 'object' && (b as { enabled?: unknown }).enabled === true,
    ),
  )
  return Object.keys(shown).length > 0 ? shown : null
}

/** sha256 hex of everything that decides how the room is lit. */
export function computeBakeFingerprint(input: BakeFingerprintInput): string {
  const exhibition: Record<string, unknown> = {}
  for (const field of LIGHT_FIELDS) exhibition[field] = input.exhibition[field] ?? null

  const benches = shownBenches(input.exhibition.benchSettings)

  const placed = input.placed
    .map(reducePlaced)
    .sort((a, b) => String(a.artworkId).localeCompare(String(b.artworkId)))

  return createHash('sha256')
    .update(
      canonicalJson({
        bakerVersion: BAKER_VERSION,
        spaceModelVersion: input.spaceModelVersion,
        spaceLookVersion: input.spaceLookVersion,
        ...(showsPanels(exhibition.panelSettings) ? { panelsBaked: PANELS_BAKED } : {}),
        ...(benches ? { benches } : {}),
        exhibition,
        placed,
      }),
    )
    .digest('hex')
}
