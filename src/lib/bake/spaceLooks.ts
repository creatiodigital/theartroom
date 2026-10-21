import { COMMON_FLOOR, type CommonFloor } from './commonFloor'
import { TRACK_THROW_NO_LIMIT } from './trackThrow'

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
 * exhibition still stores (lamp colors, window glass, the floor, the eye): in a baked space those
 * stored values are ignored for these. The artist keeps wall and ceiling paint, decoration, the
 * lamp dimmers, the track lamps' beam and throw, aim, on/off and the lighting set (rule 7; the
 * beam, throw and ceiling since 2026-10-20 — `APPROVED_ROOM_SETTINGS`).
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
  /** White wall paint's reflectance (the wall color scales it). */
  paintReflectance: number
  /** Switch and socket plastic's reflectance. */
  plasticReflectance: number
  /** Recessed and round lamps: light (and disc) color. */
  lampColor: string
  /** Track lamps: light color, fixture body color. */
  trackLampColor: string
  trackBodyColor: string
  /** The visitor's eye: vertical field of view (degrees) and height (meters). */
  cameraFOV: number
  cameraElevation: number
  floor: CommonFloor
}

/**
 * Paris and Vienna: their approved look (Eduardo 2026-10-18 — Paris on Permanence and Kritzendorf,
 * Vienna on Florescere, the same settings), with the room settings of "The Beauty of Permanence"
 * (lamp colors, window glass, eye) every one of those links used — and stronger lamps.
 *
 * A space's camera is fixed where its brightest (sunlit) work stays below paper white, so a white
 * wall or passepartout shows white only under about 340 lx there; under ordinary gallery light
 * (150–200 lx) they read grey. Eduardo, 2026-10-21: "if an almost white wall and a 100% white
 * passepartout render greyish, we have to improve the lighting". 1.7× the approved light lit the
 * room well but "a little too much"; once the passepartout and the paper border showed their own
 * color like the image (AR-163), 1.35× still left patches of light on the walls and a washed-out
 * floor ("lower the intensity of the light in general"). So 1.15×: downlights 10,000 → 11,500 lm
 * (after 6,800 → 10,000 on 2026-10-20/21), track ×0.5 → ×0.575. The cameras stay; the artist dims
 * from there (50–100%).
 */
const PARIS_VIENNA: SpaceLook = {
  recessedLumens: 11500,
  corridorLumens: 3000,
  roundLumens: 3000,
  trackScale: 0.575,
  sunLux: 5000,
  sunElevationDeg: 35,
  // Straight in (360° = 0°, written as the approved links set it).
  sunAzimuthDeg: 360,
  daylightGain: 6,
  windowColor: '#f5fbff',
  windowIntensity: 4.2,
  paintReflectance: 0.9,
  plasticReflectance: 0.85,
  lampColor: '#ffffff',
  trackLampColor: '#fffeeb',
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
  paintReflectance: 0.9,
  plasticReflectance: 0.85,
  lampColor: '#ffffff',
  trackLampColor: '#ffffff',
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

/** The room settings an exhibition owns that each approved look was made with. */
export interface ApprovedRoomSettings {
  /** Track lamps' beam angle (radians). */
  trackLampAngle: number
  /** Track lamps' throw (`trackThrow.ts`). */
  trackLampDistance: number
  ceilingColor: string
}

/**
 * Eduardo 2026-10-20: the track lamps' beam and throw and the ceiling color are the artist's
 * again — baked and fingerprinted, like the wall color. These are the values every approved look
 * was made with (the beam angle Permanence's (Paris, Vienna) / Vivrière's (Madrid), no cut-off, a
 * white ceiling): `scripts/reset-light-levels.ts` puts every exhibition in a baked space here once
 * at rollout, and a new exhibition in a baked space starts here, so the approved looks hold until
 * someone moves a slider. Not part of a space's look (`spaceLookVersion` does not hash them): a
 * bake depends on each exhibition's stored values, which its fingerprint covers.
 */
export const APPROVED_ROOM_SETTINGS: Record<string, ApprovedRoomSettings> = {
  paris: { trackLampAngle: 0.8, trackLampDistance: TRACK_THROW_NO_LIMIT, ceilingColor: '#ffffff' },
  vienna: { trackLampAngle: 0.8, trackLampDistance: TRACK_THROW_NO_LIMIT, ceilingColor: '#ffffff' },
  // Madrid has no track lamps: its beam is Vivrière's, and lights nothing there.
  madrid: {
    trackLampAngle: 0.45,
    trackLampDistance: TRACK_THROW_NO_LIMIT,
    ceilingColor: '#ffffff',
  },
}
