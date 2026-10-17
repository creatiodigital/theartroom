'use client'

import { useSyncExternalStore } from 'react'
import { Color } from 'three'
import type { MeshLambertMaterial, Texture } from 'three'

/**
 * ⚠️ AR-161 REALISM PROBE — DEV-ONLY, THROWAWAY. DO NOT SHIP.
 *
 * A live A/B harness for the lighting pipeline, driven by `RealismProbePanel`. It changes
 * RENDERING ONLY — nothing here reads from or writes to the exhibition record, so it is safe
 * against real (even production) exhibition data.
 *
 * `enabled: false` is byte-for-byte the shipped look: every consumer falls through to its
 * production branch. With `enabled: true` and every knob at its default the look is also
 * unchanged — the knobs are deltas from today, so toggling `enabled` is the A/B.
 *
 * In production builds the store never leaves `PROBE_OFF`.
 *
 * Remove this file, the panel, and every `useRealismProbe` call site before AR-161 merges.
 */

export type ToneMappingChoice = 'ACES_FILMIC' | 'AGX' | 'NEUTRAL'

/**
 * How walls/ceiling use the Blender bake.
 * - `current`: bake as the wall COLOUR, then lit again by ambient + every spotlight (shipped).
 * - `unlit`: the bake exactly as baked, ignoring all realtime light — the diagnostic "does the
 *   bake itself look real?" view. Spotlight pools vanish from the walls in this mode.
 * - `lightmap`: the bake as LIGHT arriving at a white wall; spotlights add on top.
 */
export type SurfaceMode = 'current' | 'unlit' | 'lightmap'

/** Floor debug view: the full material, its colour alone, its lighting alone, its reflection alone. */
export type FloorDebugView = 'normal' | 'albedo' | 'lighting' | 'reflection'

export interface RealismProbeState {
  /** Master switch. Off = production look exactly. */
  enabled: boolean
  /** `physical` pins every knob below to PHYSICAL; `baked` adds the load-time light bake. */
  preset: 'manual' | 'physical' | 'baked' | 'baked-next'
  /** Load-time light bake of walls/ceiling/floor from this exhibition's real lamps (spike). */
  bake: boolean
  /** EXPERIMENT: window glass emits daylight into the bake. */
  daylight: boolean
  /** EXPERIMENT: camera exposed for the brightest lit wall/art, measured from the bake. */
  autoExposure: boolean
  /**
   * EXPERIMENT: general light — irradiance an indirect uplight wash puts on the ceiling
   * (three units; spot pools on the walls are ~3–4). 0 = off. Bounced into the room by the bake.
   */
  ceilingWash: number
  /** EXPERIMENT: camera white balance to the lamps, as a photographer would set it. */
  whiteBalance: boolean
  /**
   * EXPERIMENT: round/recessed lamps are diffused ceiling fixtures (plafond, opal downlight)
   * lighting the whole room below them — the room's general light — instead of narrow cones.
   */
  downlightFlood: boolean
  /** EXPERIMENT: the beam override applies to art spots only; downlights keep their field. */
  spotPenumbraTrackOnly: boolean
  /** Material colours stop being multiplied by the ambient light's colour × 1.5. */
  neutralMaterialTint: boolean
  /** Floor overrides keep the exhibition's own floor texture, tiling and rotation. */
  floorKeepStoredTexture: boolean

  /** Artworks receive the lamps (Lambert) instead of glowing like screens (unlit Basic). */
  artworkLit: boolean
  /** Multiplier on a LIT artwork's colour. 1 = physically neutral. */
  artworkGain: number
  /** Drop the ambient colour tint that is multiplied into every artwork today. */
  artworkNeutralTint: boolean

  surfaceMode: SurfaceMode
  /** Wall/ceiling reflectance in `unlit` and `lightmap`. Real gallery white paint ≈ 0.8–0.9. */
  surfaceAlbedo: number
  /** 1 = the bake exactly as baked. */
  bakeStrength: number
  /** Ceiling gets its own albedo/strength instead of sharing the walls'. */
  ceilingSeparate: boolean
  ceilingAlbedo: number
  ceilingStrength: number

  /** Override the exhibition's floor (render only — never saved). */
  floorOverride: boolean
  floorMaterial: string
  /** Real-world size of one texture tile, in metres. Sets plank size. */
  floorTileMeters: number
  floorRotation: number
  floorReflectiveness: number
  floorNormalScale: number
  /** Multiplier on the floor colour (≤ 1). */
  floorBrightness: number
  /**
   * Floor roughness, decoupled from reflectiveness. Production derives it as
   * `1 − reflectiveness × 0.2` ≈ 0.94 at the default 0.3: almost no sheen at all.
   */
  floorRoughness: number
  floorMetalness: number
  floorAoIntensity: number
  /** Floor-only environment reflection strength (envMapIntensity). */
  floorEnvIntensity: number
  floorTint: string
  floorAnisotropy: number

  floorDebug: FloorDebugView
  floorMapAlbedo: boolean
  floorMapNormal: boolean
  floorMapRoughness: boolean
  floorMapAo: boolean
  floorMapMetalness: boolean

  /** The reflector's second render pass, on/off. Off = plain MeshStandardMaterial. */
  floorReflections: boolean
  /** drei: reflection multiplies the albedo. fresnel: added on top, stronger at grazing angles. */
  floorReflMode: 'drei' | 'fresnel'
  floorFresnelF0: number
  /** Sample the reflection's normal/roughness with the tiled UVs, not one stretched tile. */
  floorFixReflUv: boolean
  floorMixStrength: number
  floorMirror: number
  floorMixBlur: number
  floorMixContrast: number
  floorBlur: number
  floorReflResolution: number
  floorDepthScale: number
  floorMinDepth: number
  floorMaxDepth: number

  /** Scene environment strength (Standard materials only: floor, frames, lamps). */
  envOverride: boolean
  envIntensity: number
  /** Environment = the real room captured from the visitor's position (RoomEnvironmentCapture). */
  envCapture: boolean
  /** Artwork surface when lit: Lambert (no environment) or Standard (room bounce + Fresnel). */
  artworkMaterial: 'lambert' | 'standard'
  artworkRoughness: number

  /**
   * Directional fill instead of flat ambient. AmbientLight ignores surface normals, so a floor
   * lit mostly by it shows its normal map as nothing — a photo on a flat sheet. A hemisphere
   * light (bright from above, warm bounce from below) shades by normal, so relief reads.
   */
  hemiIntensity: number
  hemiSky: string
  hemiGround: string

  /**
   * One soft directional "key" light, no shadow. Everything else lighting the room is
   * symmetric — flat ambient, a hemisphere that only knows up from down, an environment
   * with four equal walls — so two faces of a panel at 90° get identical light and the
   * corner disappears. A key from one side gives every face its own value.
   */
  keyIntensity: number
  keyAzimuth: number
  keyElevation: number
  keyColor: string

  /** Override the exhibition's stored ambient light. */
  ambientOverride: boolean
  ambientIntensity: number
  /** White instead of the stored (usually cool blue-grey #e4e8f2) ambient colour. */
  ambientNeutral: boolean

  /** Multiplier on every spotlight. */
  lampScale: number
  /** Replace each lamp's authored penumbra (0.8–1 today: 80–100% of the cone is falloff). */
  spotPenumbraOverride: boolean
  spotPenumbra: number
  /** `distance = 0`: pure inverse-square, instead of the 5 m cut-off that kills the tail. */
  spotNoCutoff: boolean

  toneMapping: ToneMappingChoice
  exposure: number
  /**
   * three's ACES pre-scales by 1/0.6 (tonemapping_pars_fragment:62); AgX and Neutral do not.
   * On, AgX/Neutral get the same ×1.67 so the A/B compares curves, not brightness.
   */
  matchAcesBrightness: boolean
  bloom: boolean
}

export const PROBE_DEFAULTS: RealismProbeState = {
  enabled: false,
  preset: 'manual',
  bake: false,
  daylight: false,
  autoExposure: false,
  ceilingWash: 0,
  whiteBalance: false,
  downlightFlood: false,
  spotPenumbraTrackOnly: false,
  neutralMaterialTint: false,
  floorKeepStoredTexture: false,
  artworkLit: false,
  artworkGain: 1,
  artworkNeutralTint: false,
  surfaceMode: 'current',
  surfaceAlbedo: 0.85,
  bakeStrength: 1,
  ceilingSeparate: false,
  ceilingAlbedo: 0.85,
  ceilingStrength: 1,
  floorOverride: false,
  floorMaterial: 'parquet-soft',
  floorTileMeters: 1.6,
  floorRotation: 0,
  floorReflectiveness: 0.3,
  floorNormalScale: 1,
  floorBrightness: 1,
  floorRoughness: 0.94,
  floorMetalness: 0.05,
  floorAoIntensity: 1,
  floorEnvIntensity: 1,
  floorTint: '#ffffff',
  floorAnisotropy: 16,
  floorDebug: 'normal',
  floorMapAlbedo: true,
  floorMapNormal: true,
  floorMapRoughness: true,
  floorMapAo: true,
  floorMapMetalness: true,
  floorReflections: true,
  floorReflMode: 'drei',
  floorFresnelF0: 0.04,
  floorFixReflUv: false,
  floorMixStrength: 0.45,
  floorMirror: 0.009,
  floorMixBlur: 0.9,
  floorMixContrast: 1,
  floorBlur: 500,
  floorReflResolution: 1024,
  floorDepthScale: 0,
  floorMinDepth: 0.9,
  floorMaxDepth: 1,
  envOverride: false,
  envIntensity: 0.6,
  envCapture: false,
  artworkMaterial: 'lambert',
  artworkRoughness: 0.85,
  hemiIntensity: 0,
  hemiSky: '#ffffff',
  hemiGround: '#8a7560',
  keyIntensity: 0,
  keyAzimuth: 45,
  keyElevation: 35,
  keyColor: '#fff6ec',
  ambientOverride: false,
  ambientIntensity: 1,
  ambientNeutral: false,
  lampScale: 1,
  spotPenumbraOverride: false,
  spotPenumbra: 0.4,
  spotNoCutoff: false,
  toneMapping: 'ACES_FILMIC',
  exposure: 1,
  matchAcesBrightness: true,
  bloom: true,
}

const PROBE_OFF: RealismProbeState = PROBE_DEFAULTS

/**
 * Physically based, no artistic fudge. Every value is either a real-world quantity or "as
 * authored" (the texture's own maps at ×1). What is deliberately ABSENT: ambient light,
 * hemisphere and key fills (no physical source), colour tints, the artwork gain, bloom (a lens
 * artefact Cycles does not produce), metalness on wood/concrete.
 *
 * Two numbers are calibration, not physics, and are set once by measurement: `lampScale`
 * (the realtime lamps and the bake were never authored in the same units — the re-bake fixes
 * that) and `exposure` (the camera).
 */
const PHYSICAL: Partial<RealismProbeState> = {
  enabled: true,
  neutralMaterialTint: true,
  // Prints are matte paper lit by the lamps: diffuse, reflectance as authored.
  artworkLit: true,
  artworkGain: 1,
  artworkNeutralTint: true,
  // Bake = light arriving at the surface; matte paint is Lambertian (albedo/π) by definition.
  surfaceMode: 'lightmap',
  surfaceAlbedo: 0.8,
  bakeStrength: 1,
  ceilingSeparate: true,
  ceilingAlbedo: 0.85,
  ceilingStrength: 1,
  ambientOverride: true,
  ambientIntensity: 0,
  ambientNeutral: true,
  hemiIntensity: 0,
  keyIntensity: 0,
  envOverride: true,
  envIntensity: 1,
  // Bounce for everything unbaked comes from the real room, captured — not a flat ambient.
  envCapture: true,
  // Matte paper: diffuse + a little Fresnel sheen, and it receives the room's bounce.
  artworkMaterial: 'standard',
  // Matte paper: diffuse + a little Fresnel sheen.
  artworkRoughness: 0.85,
  // Inverse-square with no cut-off; a real track fixture's beam edge.
  lampScale: 4,
  spotPenumbraOverride: true,
  spotPenumbra: 0.4,
  // Constant general light in every space (indirect ceiling wash, bounced by the bake), so a
  // room never depends on its art spots to be visible.
  ceilingWash: 3,
  // Crisp edge for ART spots only; downlights keep their wide soft field (a hard-edged
  // downlight pool left dark bands across the floor).
  spotPenumbraTrackOnly: true,
  spotNoCutoff: true,
  toneMapping: 'AGX',
  exposure: 1,
  matchAcesBrightness: false,
  bloom: false,
  // Floor: the exhibition's texture, its own roughness map at ×1, dielectric, Fresnel gloss.
  floorOverride: true,
  floorKeepStoredTexture: true,
  floorDebug: 'normal',
  floorRoughness: 1,
  floorMetalness: 0,
  floorNormalScale: 1,
  floorAoIntensity: 1,
  floorEnvIntensity: 1,
  floorTint: '#ffffff',
  floorBrightness: 1,
  floorAnisotropy: 16,
  floorMapAlbedo: true,
  floorMapNormal: true,
  floorMapRoughness: true,
  floorMapAo: true,
  floorMapMetalness: false,
  // The planar reflector ADDS to the PBR environment reflection (double specular) and is the
  // most expensive pass in the scene. With the real room as the environment, the floor's
  // reflection is the standard split-sum PBR one: Fresnel- and roughness-correct, no fudge.
  floorReflections: false,
  floorReflMode: 'fresnel',
  floorFresnelF0: 0.04,
  floorFixReflUv: true,
  floorMixStrength: 1,
  floorMirror: 0,
  floorMixBlur: 1,
  floorMixContrast: 1,
  floorDepthScale: 0,
}

/**
 * `baked-next`: the experiment queue on top of the approved `baked` look. Never the default —
 * only reachable by `?ar161=baked-next`, so the approved look in Eduardo's browser cannot
 * change under him while experiments run.
 */
const NEXT: Partial<RealismProbeState> = {
  daylight: true,
  // Not auto-exposure: the camera is fixed (CAMERA_EXPOSURE) and may only be stopped DOWN,
  // when the brightest-lit artwork would otherwise pass paper white. Never brightened.
  autoExposure: true,
  exposure: 1,
  whiteBalance: true,
  toneMapping: 'NEUTRAL',
  artworkRoughness: 1,
  // General light from the real ceiling fixtures, not an invisible wash.
  downlightFlood: true,
  ceilingWash: 0,
  // Glare around the light sources, as an eye or a lens sees it — prod's settings: only what
  // passes 2.0 linear (lamp bulbs, daylit window glass) glows; walls and art stay below it.
  bloom: true,
}

/**
 * Camera calibration, the same for every exhibition: exposure 1 under Khronos Neutral, and one
 * three irradiance unit = 200 / 2.81 ≈ 71 lx. Paper white (reflectance 0.85) under 200 lx — the
 * museum level for paintings — then has radiance 0.85 × 2.81 / π = 0.76: the top of Neutral's
 * identity range, the brightest a colour can show before it is compressed toward white.
 */
export const CAMERA_EXPOSURE = 1
export const LUX_PER_UNIT = 200 / 2.81

/** A diffused LED ceiling fixture (plafond / opal downlight), as specified by its makers. */
const DOWNLIGHT_LUMENS = 3000

/**
 * The fixture's on-axis intensity. three's SpotLight at angle 90°, penumbra 1 falls off as
 * smoothstep(0, 1, cosθ) — a diffuser's cosine-like distribution — and integrates over the
 * hemisphere to exactly π·I₀, so Φ = π·I₀ (lm → cd), then candela → three units.
 */
const DOWNLIGHT_INTENSITY = DOWNLIGHT_LUMENS / Math.PI / LUX_PER_UNIT

const effectiveOf = (raw: RealismProbeState): RealismProbeState =>
  raw.enabled &&
  (raw.preset === 'physical' || raw.preset === 'baked' || raw.preset === 'baked-next')
    ? {
        ...raw,
        ...PHYSICAL,
        bake: raw.preset === 'baked' || raw.preset === 'baked-next',
        lampScale: raw.lampScale,
        exposure: raw.exposure,
        ...(raw.preset === 'baked-next' ? NEXT : {}),
      }
    : raw

export const PROBE_AVAILABLE = process.env.NEXT_PUBLIC_APP_ENV !== 'production'

/** DEBUG A/B (spike): a positive number from the visit URL, e.g. `&ar161paint=0.9`. */
export const probeUrlNumber = (name: string): number | null => {
  if (!PROBE_AVAILABLE || typeof window === 'undefined') return null
  const value = Number(new URLSearchParams(window.location.search).get(name))
  return value > 0 ? value : null
}

/**
 * Switch / socket plastic. Authored `#d8d8d8` only looked white under prod's ambient tint
 * (×1.5); `&ar161plastic=<reflectance>` renders it as a real plastic of that reflectance.
 */
export const probePlasticColor = (authored: string): string => {
  const reflectance = probeUrlNumber('ar161plastic')
  return reflectance === null ? authored : `#${new Color().setScalar(reflectance).getHexString()}`
}

const STORAGE_KEY = 'ar161-realism-probe'

const readStored = (): RealismProbeState => {
  let stored = PROBE_DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) stored = { ...PROBE_DEFAULTS, ...JSON.parse(raw) }
  } catch {
    // Blocked storage: defaults.
  }
  // `?ar161=baked | physical | off` — a link that sets the look without touching the panel.
  // A clean slate: the preset on top of DEFAULTS, so earlier panel experiments (a floor
  // override, say) cannot leak in.
  const preset = new URLSearchParams(window.location.search).get('ar161')
  if (preset === 'baked' || preset === 'physical' || preset === 'baked-next') {
    stored = { ...PROBE_DEFAULTS, enabled: true, preset, lampScale: 3, exposure: 2 }
  } else if (preset === 'off') {
    stored = PROBE_DEFAULTS
  } else {
    return stored
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Not persisted; still applied for this page.
  }
  return stored
}

let state: RealismProbeState | null = null
let effective: RealismProbeState | null = null
const listeners = new Set<() => void>()

const getRawSnapshot = (): RealismProbeState => {
  if (!PROBE_AVAILABLE) return PROBE_OFF
  // Lazy so the server render and the first client render both see defaults until the
  // store is touched from the browser.
  if (state === null) state = typeof window === 'undefined' ? PROBE_DEFAULTS : readStored()
  return state
}

const getSnapshot = (): RealismProbeState => {
  if (!PROBE_AVAILABLE) return PROBE_OFF
  if (effective === null) effective = effectiveOf(getRawSnapshot())
  return effective
}

const getServerSnapshot = (): RealismProbeState => PROBE_OFF

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const setRealismProbe = (patch: Partial<RealismProbeState>) => {
  if (!PROBE_AVAILABLE) return
  state = { ...getRawSnapshot(), ...patch }
  effective = effectiveOf(state)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Private window / blocked storage: the probe still works, it just won't persist.
  }
  listeners.forEach((listener) => listener())
}

/** What the panel edits: the knobs as set, before a preset pins them. */
export const getRealismProbe = getRawSnapshot
/** What the scene renders. */
export const getEffectiveRealismProbe = getSnapshot

/** Spotlight intensity / angle / penumbra / distance after the probe's overrides. */
export const probeSpot = (
  probe: RealismProbeState,
  spot: { intensity: number; angle: number; penumbra: number; distance: number },
  // The beam override is for ART spots (a crisp scallop around the work); downlights keep
  // their authored wide, soft field — a hard-edged downlight pool reads as a stage light.
  kind: 'track' | 'downlight' = 'downlight',
) => {
  if (!probe.enabled) return spot
  if (kind === 'downlight' && probe.downlightFlood) {
    // A diffused ceiling fixture in absolute units — the stored level was tuned blind, under
    // the old fake light. A lamp the artist dimmed to 0 stays off.
    return {
      intensity: spot.intensity > 0 ? DOWNLIGHT_INTENSITY : 0,
      angle: Math.PI / 2,
      penumbra: 1,
      distance: 0,
    }
  }
  return {
    intensity: spot.intensity * probe.lampScale,
    angle: spot.angle,
    penumbra:
      probe.spotPenumbraOverride && (kind === 'track' || !probe.spotPenumbraTrackOnly)
        ? probe.spotPenumbra
        : spot.penumbra,
    distance: probe.spotNoCutoff ? 0 : spot.distance,
  }
}

// While the bake gathers lamps, every room's lamps are mounted: Vienna culls the lights of
// the room the visitor is not in (useActiveRoom), but the bake lights every room at once.
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

// Exposure metered from the bake (set by LoadTimeBake), separate from the stored knob so a
// metered value never persists into another preset.
let meteredWhiteBalance: [number, number, number] | null = null
const whiteBalanceListeners = new Set<() => void>()
export const setMeteredWhiteBalance = (gain: [number, number, number] | null) => {
  meteredWhiteBalance = gain
  whiteBalanceListeners.forEach((l) => l())
}
export const useMeteredWhiteBalance = () =>
  useSyncExternalStore(
    (l) => {
      whiteBalanceListeners.add(l)
      return () => whiteBalanceListeners.delete(l)
    },
    () => meteredWhiteBalance,
    () => null,
  )

let meteredExposure: number | null = null
const exposureListeners = new Set<() => void>()
export const setMeteredExposure = (value: number | null) => {
  meteredExposure = value
  exposureListeners.forEach((l) => l())
}
export const useMeteredExposure = () =>
  useSyncExternalStore(
    (l) => {
      exposureListeners.add(l)
      return () => exposureListeners.delete(l)
    },
    () => meteredExposure,
    () => null,
  )

/** Renderer exposure for the probe's tone-mapping choice. */
export const probeExposure = (probe: RealismProbeState, metered: number | null = null): number => {
  if (!probe.enabled) return 1
  if (probe.autoExposure && metered !== null) return metered
  const match = probe.matchAcesBrightness && probe.toneMapping !== 'ACES_FILMIC'
  return probe.exposure * (match ? 1 / 0.6 : 1)
}

export const useRealismProbe = (): RealismProbeState =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

/**
 * Walls/ceiling surface mode. Moves the bake between `map`, `emissiveMap` and `lightMap` on
 * the space's Lambert material and, outside `current`, owns the material colour.
 *
 * Returns true when it took over the colour, so the caller skips its production tint.
 *
 * Maths, for whoever reads the numbers: three r155+ Lambert computes
 * `irradiance × albedo / π`, and a light map adds `texel × lightMapIntensity` to irradiance.
 * So `lightMapIntensity = bakeStrength × π` makes a white wall show the bake exactly as
 * baked, scaled by `surfaceAlbedo`. `unlit` gets the same result through emissive with a
 * black diffuse colour, which no light can touch.
 */
export const applyBakeProbe = (
  material: MeshLambertMaterial,
  bake: Texture,
  baseColor: string,
  probe: RealismProbeState,
  surfaceKind: 'wall' | 'ceiling' = 'wall',
): boolean => {
  const mode: SurfaceMode = probe.enabled ? probe.surfaceMode : 'current'
  const ownCeiling = surfaceKind === 'ceiling' && probe.ceilingSeparate
  const albedo = ownCeiling ? probe.ceilingAlbedo : probe.surfaceAlbedo
  const strength = ownCeiling ? probe.ceilingStrength : probe.bakeStrength
  const want = {
    map: mode === 'current' ? bake : null,
    emissiveMap: mode === 'unlit' ? bake : null,
    lightMap: mode === 'lightmap' ? bake : null,
  }

  if (
    material.map !== want.map ||
    material.emissiveMap !== want.emissiveMap ||
    material.lightMap !== want.lightMap
  ) {
    material.map = want.map
    material.emissiveMap = want.emissiveMap
    material.lightMap = want.lightMap
    // USE_MAP / USE_EMISSIVEMAP / USE_LIGHTMAP are compile-time defines: rebuild the program.
    material.needsUpdate = true
  }

  if (mode === 'current') {
    material.emissive.setRGB(0, 0, 0)
    return false
  }

  const surface = new Color(baseColor).multiplyScalar(albedo * strength)
  bake.channel = 0
  if (mode === 'unlit') {
    material.color.setRGB(0, 0, 0)
    material.emissive.copy(surface)
  } else {
    material.emissive.setRGB(0, 0, 0)
    material.lightMapIntensity = strength * Math.PI
    material.color = new Color(baseColor).multiplyScalar(albedo)
  }
  return true
}
