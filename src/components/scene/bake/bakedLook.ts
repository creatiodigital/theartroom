'use client'

import { useSyncExternalStore } from 'react'
import { useSelector } from 'react-redux'
import { Color } from 'three'
import type { MeshLambertMaterial, Texture } from 'three'

import { isBakeRecord, type BakeRecord } from '@/lib/bake/bakeRecord'
import { isBakedSpace } from '@/lib/bake/bakedSpaces'
import { spaceLooks, type SpaceLook } from '@/lib/bake/spaceLooks'
import type { RootState } from '@/redux/store'

import { useBakePage, type BakePage } from './bakePage'

/**
 * ⚠️ AR-161 — which look a room renders with.
 *
 * - The space's approved look (`baked`): the light is the room's bake — its lamps, daylight and
 *   sun as the space rates them (`spaceLooks`) — on physically based surfaces: matte paper and
 *   paint, no ambient fill, the room itself as the environment, Khronos PBR Neutral at the space's
 *   fixed camera, bloom on the lamps and window glass, every artwork image exactly its file. The values
 *   the space owns replace the exhibition's stored ones (`SpaceLook`); the artist's — wall and
 *   ceiling color, the dimmers, the track lamps' beam, throw, aim and on/off — are the stored ones.
 * - Today's realtime look (`TODAY_LOOK`): exactly the production look from before AR-161 — the 3D
 *   editor's live preview, every space without a bake, and an exhibition in a baked space until it
 *   has one.
 */
export type LookState = { baked: false } | { baked: true; space: SpaceLook }

export const TODAY_LOOK: LookState = { baked: false }

/** One per space, so a look keeps its identity from render to render. */
const APPROVED_LOOKS: Record<string, LookState> = Object.fromEntries(
  Object.entries(spaceLooks).map(([spaceId, { look }]) => [spaceId, { baked: true, space: look }]),
)

// Stored bakes that failed to go on during this page's life — a map or the plaster failed to load,
// the room's unwrap no longer matches the bake's, applying it threw. The room falls back to today's
// look for good (reload to try again): never a half-lit room, never the approved look without its
// bake.
const failedBakes = new Set<string>()
let failures = 0
const failureListeners = new Set<() => void>()

/** A stored bake could not be shown: its room goes back to today's look. */
export const markStoredBakeFailed = (bakeId: string) => {
  if (failedBakes.has(bakeId)) return
  failedBakes.add(bakeId)
  failures++
  failureListeners.forEach((l) => l())
}

const useFailures = () =>
  useSyncExternalStore(
    (l) => {
      failureListeners.add(l)
      return () => failureListeners.delete(l)
    },
    () => failures,
    () => 0,
  )

/**
 * The one test of whether a stored bake will be shown on the room: a bake record in a baked space
 * (with its look), that has not failed to go on. While it holds, the room is in the space's approved
 * look and the loader waits for the bake (`BakedLighting`); once the bake fails it no longer holds,
 * and everything — materials, lamps, effects, camera — is today's look again.
 */
export const shownStoredBake = (
  spaceId: string | null | undefined,
  bake: unknown,
): BakeRecord | null =>
  isBakedSpace(spaceId) && spaceLooks[spaceId!] && isBakeRecord(bake) && !failedBakes.has(bake.id)
    ? bake
    : null

/** `shownStoredBake` for the exhibition on the page (the published bake, a preview's, the draft in review). */
export const useShownStoredBake = (): BakeRecord | null => {
  useFailures()
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId)
  const bake = useSelector((state: RootState) => state.exhibition.bake)
  return shownStoredBake(spaceId, bake)
}

/** The page's stored bake failed to go on (the room shows today's look). */
export const useStoredBakeFailed = (): boolean => {
  useFailures()
  const bake = useSelector((state: RootState) => state.exhibition.bake)
  return isBakeRecord(bake) && failedBakes.has(bake.id)
}

/**
 * The look for a room: the space's approved look when the space is baked and the page lights it
 * with a bake — a stored one that will be shown (`shownStoredBake`: visitors' published bake, the
 * admin's review, a bake preview link) or the one the admin is making (bake mode). Today's look
 * otherwise — a stored bake that failed included — and always outside the visit page (`page` null:
 * the 3D editor).
 */
export const lookFor = (
  page: BakePage['mode'] | null,
  spaceId: string | null | undefined,
  storedBake: boolean,
): LookState => {
  if (page === null || !isBakedSpace(spaceId) || !(storedBake || page === 'bake')) return TODAY_LOOK
  return APPROVED_LOOKS[spaceId!] ?? TODAY_LOOK
}

/** The look this room renders with (see `lookFor`). */
export const useBakedLook = (): LookState => {
  const page = useBakePage()
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId)
  const shown = useShownStoredBake() !== null
  return lookFor(page?.mode ?? null, spaceId, shown)
}

/** Diagnostics (the `window.__ar161*` hooks the headless tools read, the meter logs): never in production. */
export const BAKE_DEBUG = process.env.NEXT_PUBLIC_APP_ENV !== 'production'

/**
 * Camera calibration, the same for every space: exposure 1 under Khronos Neutral, and one three
 * irradiance unit = 200 / 2.81 ≈ 71 lx. Paper white (reflectance 0.85) under 200 lx — the museum
 * level for paintings — then has radiance 0.85 × 2.81 / π = 0.76: the top of Neutral's identity
 * range, the brightest a color can show before it is compressed toward white.
 */
export const CAMERA_EXPOSURE = 1
export const LUX_PER_UNIT = 200 / 2.81

/** A track head's beam edge: the inner 60% of its cone at full strength. */
const TRACK_PENUMBRA = 0.4

/**
 * A spotlight as the look lights it. Today's look: as authored. The approved look, in absolute
 * units:
 * - downlights (`recessed`, round lamps) are diffused ceiling fixtures at the space's rating — a
 *   90° field whose smoothstep falloff integrates to π·I₀, so Φ = π·I₀ (lm → cd → three units) —
 *   times the artist's ceiling-lamp `dimmer` (50–100%; the stored level no longer switches them);
 * - track heads keep their aim, beam and throw (the artist's) at the space's scale, with a crisp
 *   edge — the throw is three's `distance` (`trackThrow.ts`; 0, no cut-off, by default), which
 *   the bake applies exactly as three does;
 * - downlights fall off by the inverse square alone, with no cut-off distance.
 */
export const lookSpot = (
  look: LookState,
  spot: { intensity: number; angle: number; penumbra: number; distance: number },
  kind: 'track' | 'downlight' | 'recessed' = 'downlight',
  dimmer?: number,
) => {
  if (!look.baked) return spot
  if (kind !== 'track') {
    const lumens = kind === 'recessed' ? look.space.recessedLumens : look.space.roundLumens
    const rating = lumens / Math.PI / LUX_PER_UNIT
    const share = dimmer ?? (spot.intensity > 0 ? 1 : 0)
    return { intensity: rating * share, angle: Math.PI / 2, penumbra: 1, distance: 0 }
  }
  return {
    intensity: spot.intensity * look.space.trackScale,
    angle: spot.angle,
    penumbra: TRACK_PENUMBRA,
    distance: spot.distance,
  }
}

/**
 * Switch and socket plastic. The authored `#d8d8d8` only looked white under today's ambient tint
 * (×1.5); the baked look renders it as a real plastic of the space's reflectance.
 */
export const plasticColor = (look: LookState, authored: string): string =>
  look.baked ? `#${new Color().setScalar(look.space.plasticReflectance).getHexString()}` : authored

/** Matte paint reflectance of the walls and the ceiling until the room's bake is on them. */
const SURFACE_ALBEDO = { wall: 0.8, ceiling: 0.85 }

/**
 * A space's walls / ceiling (Lambert) and its Blender bake. Today's look: the bake is the surface's
 * color, tinted by the caller (returns false). The approved look (returns true — the color is
 * set here): until the room's own bake replaces the material (under the loader), the Blender bake
 * is LIGHT arriving at matte paint of the artist's color — three r155+ Lambert computes
 * `irradiance × albedo / π`, so `lightMapIntensity = π` shows the bake exactly as baked.
 */
export const applySurfaceLook = (
  material: MeshLambertMaterial,
  bake: Texture,
  baseColor: string,
  look: LookState,
  surface: 'wall' | 'ceiling' = 'wall',
): boolean => {
  const map = look.baked ? null : bake
  const lightMap = look.baked ? bake : null
  if (material.map !== map || material.lightMap !== lightMap || material.emissiveMap !== null) {
    material.map = map
    material.emissiveMap = null
    material.lightMap = lightMap
    // USE_MAP / USE_LIGHTMAP are compile-time defines: rebuild the program.
    material.needsUpdate = true
  }
  material.emissive.setRGB(0, 0, 0)
  if (!look.baked) return false
  bake.channel = 0
  material.lightMapIntensity = Math.PI
  material.color = new Color(baseColor).multiplyScalar(SURFACE_ALBEDO[surface])
  return true
}

// While the bake gathers lamps, every room's lamps are mounted: Vienna culls the lights of the
// room the visitor is not in (useActiveRoom), but the bake lights every room at once.
let bakeAllRooms = false
const bakeAllRoomsListeners = new Set<() => void>()
export const setBakeAllRooms = (value: boolean) => {
  bakeAllRooms = value
  bakeAllRoomsListeners.forEach((l) => l())
}
export const useBakeAllRooms = () =>
  useSyncExternalStore(
    (l) => {
      bakeAllRoomsListeners.add(l)
      return () => bakeAllRoomsListeners.delete(l)
    },
    () => bakeAllRooms,
    () => false,
  )
