/**
 * The artist's two lamp dimmers in a baked space (AR-161, spec rule 7: "dim the recessed and
 * track lamps a bit"): one for the track lamps (`trackLampIntensity`), one for the ceiling
 * lamps (`recessedLampIntensity` — the recessed lamps, and Madrid's round lamps, which read the
 * same column).
 *
 * The stored value keeps today's slider scale: 4 is the standard, 100% of the space's
 * calibrated lamps, and the dimmer goes down to a tenth of that (AR-169, Eduardo 2026-10-31: "a
 * way to make the space darker in a realistic way"; it stopped at half before). Never above the
 * standard: a brighter room is the space's calibration, not an artist's setting.
 */
export const DIMMER_STANDARD = 4
export const DIMMER_MIN = 0.4
/** 1% per step (Eduardo 2026-10-31: "I can only increase 5% by 5%, make this 1%"). */
export const DIMMER_STEP = 0.04

/** A slider value kept to whole percents (no float noise like 3.8000000000000003 in the DB). */
export const wholePercentStep = (value: number): number => Math.round(value * 100) / 100

/**
 * The level the baked look uses: the stored slider value clamped to 0.4–4. A missing value is
 * the standard, as every lamp component already reads it (`?? 4`). Levels stored before the
 * rollout (tuned blind under the old light, e.g. 8 or 1.4) land on the nearest end until
 * `scripts/reset-light-levels.ts` puts them back to 4.
 */
export const dimmerLevel = (stored: number | null | undefined): number => {
  const level = typeof stored === 'number' && Number.isFinite(stored) ? stored : DIMMER_STANDARD
  return Math.min(DIMMER_STANDARD, Math.max(DIMMER_MIN, level))
}

/** The share of the space's calibrated light the lamps give: 0.1–1. */
export const dimmerFraction = (stored: number | null | undefined): number =>
  dimmerLevel(stored) / DIMMER_STANDARD

/** What the artist reads next to the slider: 10–100. */
export const dimmerPercent = (stored: number | null | undefined): number =>
  Math.round(dimmerFraction(stored) * 100)

/**
 * AR-169: the artist's share of the space's daylight (`daylightLevel` — blinds: the sky through
 * the windows and the sun, baked) and of its soft fill (`fillLightLevel`, `softFill.ts`: on
 * screen only), 0–1. Unset: all of it, as before the controls existed.
 */
export const lightShare = (stored: number | null | undefined): number =>
  typeof stored === 'number' && Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : 1

/**
 * AR-169 (Eduardo 2026-10-31: "add a knob to control the soft light — the sphere we created"): the
 * artist's soft light (`fillLightLevel`, `softFill.ts`), 0–2 — up to twice the space's own, not only
 * dimmer. Unset: 1, the space's.
 */
export const FILL_MAX = 2

export const fillShare = (stored: number | null | undefined): number =>
  typeof stored === 'number' && Number.isFinite(stored)
    ? Math.min(FILL_MAX, Math.max(0, stored))
    : 1
