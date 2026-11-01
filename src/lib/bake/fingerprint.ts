import { createHash } from 'node:crypto'

import { BAKER_VERSION } from './bakeRecord'
import { bakedFloor, bakedFloorTone } from './commonFloor'
import { lightShare } from './dimmer'
import { canonicalJson } from './hash'
import { spaceLooks } from './spaceLooks'

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
  // AR-169: the glass color is the artist's, and the color of the daylight it lets in.
  'windowLightColor',
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

/**
 * The floor's tone (AR-169) bounces light onto the room. Only a tone other than the space's own
 * counts, so a room that keeps the space's floor keeps its fingerprint. Like the benches, not in
 * LIGHT_FIELDS (`floorTemperature` is ignored outside it, and an unset one would hash as null).
 */
const floorTone = (exhibition: Record<string, unknown>): number | null => {
  const space = spaceLooks[String(exhibition.spaceId)]?.look.floor
  if (!space) return null
  const floor = bakedFloor(space, exhibition.floorMaterial as string | null | undefined)
  const tone = bakedFloorTone(floor, {
    floorMaterial: exhibition.floorMaterial as string | null | undefined,
    floorTemperature: exhibition.floorTemperature as number | null | undefined,
  })
  return tone === floor.tone ? null : tone
}

/**
 * The artist's daylight share (AR-169, blinds) is baked. Only a share below 1 counts, so a room
 * with all the space's daylight — every room before the control existed — keeps its fingerprint.
 * The soft fill (`fillLightLevel`) is on screen only: not here.
 */
const daylightShare = (exhibition: Record<string, unknown>): number | null => {
  const share = lightShare(exhibition.daylightLevel as number | null | undefined)
  return share === 1 ? null : share
}

/**
 * AR-169: the floor an artist chose among the baked floors (`bakedFloor`) — its color bounces onto
 * the room. Only a floor other than the space's own counts (every room before the choice keeps
 * its fingerprint).
 */
const chosenFloor = (exhibition: Record<string, unknown>): string | null => {
  const space = spaceLooks[String(exhibition.spaceId)]?.look.floor
  if (!space) return null
  const floor = bakedFloor(space, exhibition.floorMaterial as string | null | undefined)
  return floor.material === space.material ? null : floor.material
}

/** sha256 hex of everything that decides how the room is lit. */
export function computeBakeFingerprint(input: BakeFingerprintInput): string {
  const exhibition: Record<string, unknown> = {}
  for (const field of LIGHT_FIELDS) exhibition[field] = input.exhibition[field] ?? null

  const benches = shownBenches(input.exhibition.benchSettings)
  const tone = floorTone(input.exhibition)
  const floor = chosenFloor(input.exhibition)
  const daylight = daylightShare(input.exhibition)

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
        ...(tone !== null ? { floorTone: tone } : {}),
        ...(floor !== null ? { floor } : {}),
        ...(daylight !== null ? { daylight } : {}),
        exhibition,
        placed,
      }),
    )
    .digest('hex')
}
