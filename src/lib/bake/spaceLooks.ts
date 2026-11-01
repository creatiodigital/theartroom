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
  /**
   * A light well (an opening with no glass: its sky panel `windowLight{i}` emits itself) shows
   * this share of a window's daylight — it opens onto a shaded court, not the open sky. Unset: 1.
   */
  lightWellDaylight?: number
  /** Window glass: display brightness (the stored `windowLightIntensity` scale; its color is the artist's, AR-169). */
  windowIntensity: number
  /** White wall paint's reflectance (the wall color scales it). */
  paintReflectance: number
  /**
   * The share of the floor's color its bounce carries onto the walls and ceiling, at the same
   * brightness (`floorBounceAlbedo`); the floor itself looks as it is. Unset: 1, all of it.
   */
  floorBounceColor?: number
  /** Switch and socket plastic's reflectance. */
  plasticReflectance: number
  /** Recessed and round lamps: light (and disc) color. */
  lampColor: string
  /** Track lamps' light color (their body color is the artist's, AR-169). */
  trackLampColor: string
  /** The visitor's eye: vertical field of view (degrees) and height (meters). */
  cameraFOV: number
  cameraElevation: number
  floor: CommonFloor
}

/**
 * Every space's look (AR-169, Eduardo 2026-10-30: "a setup that will work nice for all spaces…
 * I don't want you to calibrate space by space"): one light setup and one camera, for the spaces
 * of today and those to come. What differs between spaces is their model (its lamps, windows and
 * light wells), never these numbers.
 *
 * History (Paris and Vienna, AR-161 → AR-165): downlights 6,800 → 10,000 → 12,500 lm and track
 * ×0.5 → ×0.625 while the camera was fixed where the brightest sunlit work stayed below paper
 * white. AR-169, after the bake matched Cycles (runs.md, session 4b), on Paris: the room at
 * 12,500 lm was "over lighted… completely incandescent" — the downlights were 72–93 % of every
 * main-room wall's light; halved, "much better now… the floor is no longer washed out": 6,250 lm.
 * Then, one value per A/B, to the approved look ("now we're talking!", runs.md "APPROVED LOOK"):
 * track spots ×¼ (0.625 → 0.15625: "now I don't see the pools on the wall"), the sky ×½
 * (`daylightGain` 6 → 3, in the bake and on the glass: "the window is still too bright"), the
 * camera 0.524 → 0.62 (`GALLERY_CAMERA`), bloom on the lamps only and the soft fill
 * (`softFill.ts`). A space's own geometry decides where each rule acts: recessed vs round
 * lamps, track or none, glass windows, light wells (`lightWellDaylight`), corridors under 6 m
 * (`corridorLumens`, recessed lamps only) — Madrid (round lamps only) shares it all.
 */
const GALLERY_LOOK: SpaceLook = {
  recessedLumens: 6250,
  corridorLumens: 3000,
  roundLumens: 3000,
  // AR-169 (Eduardo 2026-10-31: "an interior scene… some shadows and dark corners are to be
  // expected. We will compensate with the track lamps"): ×2 with the fill lowered (`softFill`), then
  // "at 93% they are barely noticeable" → ×4: 100% = the editor's realtime spots (ratings err
  // bright; the artist dims down).
  trackScale: 0.625,
  sunLux: 5000,
  sunElevationDeg: 35,
  // Straight in (360° = 0°, written as the approved links set it).
  sunAzimuthDeg: 360,
  daylightGain: 3,
  // AR-165: an opening with no glass at the end of a passage (paris22's exit corridor, its
  // `windowLight1`) at a window's full daylight burned the walls white (Eduardo 2026-10-23: "too
  // intense"). A light well opens onto a shaded court, not the open sky — in any space that has one.
  lightWellDaylight: 0.25,
  windowIntensity: 4.2,
  paintReflectance: 0.9,
  // AR-165 (Eduardo 2026-10-23): the warm floor turned the walls and ceiling beige — "just
  // reduce its influence" (the floor's look stays). First try: half its color. AR-169 (2026-10-29,
  // the neutral camera showed it as brown-pink walls): "even if the floor is very brown, walls do
  // not get tinted by it" — none of its color, at the same brightness.
  floorBounceColor: 0,
  plasticReflectance: 0.85,
  lampColor: '#ffffff',
  // AR-169 (Eduardo 2026-10-29): every space's light is the same white — "not blue, not yellow:
  // white… otherwise I will go crazy trying to calibrate each single exhibition". Was #fffeeb.
  trackLampColor: '#ffffff',
  cameraFOV: 50,
  cameraElevation: 1.6,
  floor: COMMON_FLOOR,
}

/**
 * Every space's camera. AR-169 (Eduardo 2026-10-29, "not blue, not yellow: white"): a neutral
 * white balance, so white light shows white — the metered balances (Paris [0.933, 1.01, 1.135],
 * Vienna [0.916, 1.014, 1.153], Madrid [0.92, 1.015, 1.126]) cooled the room against the warm
 * bounce and turned the white downlight discs and the sky blue. Exposure 0.62 (Paris was 0.524,
 * Vienna 0.588, Madrid 0.56): his A/B pick on the approved look (EX1, runs.md). Images are
 * file-exact whatever the exposure.
 */
const GALLERY_CAMERA: SpaceCamera = { exposure: 0.62, whiteBalance: [1, 1, 1] }

export const spaceLooks: Record<string, { camera: SpaceCamera; look: SpaceLook }> = {
  paris: { camera: GALLERY_CAMERA, look: GALLERY_LOOK },
  vienna: { camera: GALLERY_CAMERA, look: GALLERY_LOOK },
  madrid: { camera: GALLERY_CAMERA, look: GALLERY_LOOK },
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
