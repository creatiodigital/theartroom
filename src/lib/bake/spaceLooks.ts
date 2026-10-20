import { COMMON_FLOOR, type CommonFloor } from './commonFloor'

// Per-space data that decides how a baked room looks (AR-161 per-space rules: one sweet spot per
// space, never per exhibition). Plain module (no React, no Next) so the scene, the bake and the
// server fingerprint all read the same numbers: `spaceLookVersion` hashes a space's entry, so
// recalibrating a space stales its bakes.

export interface SpaceCamera {
  exposure: number
  whiteBalance: [number, number, number]
}

/**
 * Everything about a baked room's light that belongs to the space (spec rule 2). Some of it an
 * exhibition still stores (lamp colors, beam angle, window glass, ceiling color, the floor,
 * the eye): in a baked space those stored values are ignored for these. The artist keeps wall
 * paint, decoration, the lamp dimmers, aim, on/off and the lighting set (rule 7).
 */
export interface SpaceLook {
  /** Recessed downlights (diffused, 90° field): lumens at the standard dimmer. */
  recessedLumens: number
  /** Recessed downlights in a corridor (< 6 m wide) keep a standard fixture; unset: no such rule. */
  corridorLumens?: number
  /** Round ceiling lamps (plafond, opal diffuser): lumens at the standard dimmer. */
  roundLumens: number
  /** Track lamps give this × their realtime level's light at the standard dimmer. */
  trackScale: number
  /** Direct sun through each window's glass: illuminance (lux) facing it, elevation, azimuth off straight in. */
  sunLux: number
  sunElevationDeg: number
  sunAzimuthDeg: number
  /** Window glass emits this × its display brightness into the room. */
  daylightGain: number
  /** Window glass: color and display brightness (the stored `windowLightColor` / `windowLightIntensity` scale). */
  windowColor: string
  windowIntensity: number
  ceilingColor: string
  /** White wall paint's reflectance (the wall color scales it). */
  paintReflectance: number
  /** Switch and socket plastic's reflectance. */
  plasticReflectance: number
  /** Recessed and round lamps: light (and disc) color. */
  lampColor: string
  /** Track lamps: light color, beam angle (radians), fixture body color. */
  trackLampColor: string
  trackLampAngle: number
  trackBodyColor: string
  /** The visitor's eye: vertical field of view (degrees) and height (meters). */
  cameraFOV: number
  cameraElevation: number
  floor: CommonFloor
}

/**
 * Paris and Vienna: their approved look (Eduardo 2026-10-18 — Paris on Permanence and Kritzendorf,
 * Vienna on Florescere, the same settings), with the room settings of "The Beauty of Permanence"
 * (lamp colors, track beam, window glass, eye) every one of those links used.
 */
const PARIS_VIENNA: SpaceLook = {
  recessedLumens: 6800,
  corridorLumens: 3000,
  roundLumens: 3000,
  trackScale: 0.5,
  sunLux: 5000,
  sunElevationDeg: 35,
  // Straight in (360° = 0°, written as the approved links set it).
  sunAzimuthDeg: 360,
  daylightGain: 6,
  windowColor: '#f5fbff',
  windowIntensity: 4.2,
  ceilingColor: '#ffffff',
  paintReflectance: 0.9,
  plasticReflectance: 0.85,
  lampColor: '#ffffff',
  trackLampColor: '#fffeeb',
  trackLampAngle: 0.8,
  trackBodyColor: '#ffffff',
  cameraFOV: 50,
  cameraElevation: 1.6,
  floor: COMMON_FLOOR,
}

/**
 * Madrid: its approved look (Eduardo 2026-10-16/17, re-checked under the per-space rules
 * 2026-10-19), with Vivrière's room settings. Round lamps only (no recessed or track lamps, no
 * corridor rule): the recessed and track values are the defaults and light nothing here.
 */
const MADRID: SpaceLook = {
  recessedLumens: 3000,
  roundLumens: 3000,
  trackScale: 0.5,
  sunLux: 5000,
  sunElevationDeg: 35,
  // Straight in (360° = 0°, written as the approved links set it).
  sunAzimuthDeg: 360,
  daylightGain: 6,
  windowColor: '#f2f2f2',
  windowIntensity: 4.2,
  ceilingColor: '#ffffff',
  paintReflectance: 0.9,
  plasticReflectance: 0.85,
  lampColor: '#ffffff',
  trackLampColor: '#ffffff',
  trackLampAngle: 0.45,
  trackBodyColor: '#ffffff',
  cameraFOV: 50,
  cameraElevation: 1.6,
  floor: COMMON_FLOOR,
}

export const spaceLooks: Record<string, { camera: SpaceCamera; look: SpaceLook }> = {
  // AR-161: camera from the approved Permanence bake (seeded), 2026-10-18 — Kritzendorf uses it too.
  paris: { camera: { exposure: 0.524, whiteBalance: [0.933, 1.01, 1.135] }, look: PARIS_VIENNA },
  // AR-161: camera from the approved Florescere bake (seeded), 2026-10-18.
  vienna: { camera: { exposure: 0.588, whiteBalance: [0.916, 1.014, 1.153] }, look: PARIS_VIENNA },
  // AR-161: approved 2026-10-19 (Vivrière). With the sun the metered camera (0.435) would be set by
  // 2–3 works beside the sunlit windows and darken the whole room ~11%; 0.56 keeps the approved
  // room brightness. Images are file-exact either way. WB = metered.
  madrid: { camera: { exposure: 0.56, whiteBalance: [0.92, 1.015, 1.126] }, look: MADRID },
}
