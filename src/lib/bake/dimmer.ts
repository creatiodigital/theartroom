/**
 * The artist's two lamp dimmers in a baked space (AR-161, spec rule 7: "dim the recessed and
 * track lamps a bit"): one for the track lamps (`trackLampIntensity`), one for the ceiling
 * lamps (`recessedLampIntensity` — the recessed lamps, and Madrid's round lamps, which read the
 * same column).
 *
 * The stored value keeps today's slider scale: 4 is the standard, 100% of the space's
 * calibrated lamps, and the dimmer only goes down to half of that. Never above the standard:
 * a brighter room is the space's calibration, not an artist's setting.
 */
export const DIMMER_STANDARD = 4
export const DIMMER_MIN = 2
/** 5% per step. */
export const DIMMER_STEP = 0.2

/**
 * The level the baked look uses: the stored slider value clamped to 2–4. A missing value is
 * the standard, as every lamp component already reads it (`?? 4`). Levels stored before the
 * rollout (tuned blind under the old light, e.g. 8 or 1.4) land on the nearest end until
 * `scripts/reset-light-levels.ts` puts them back to 4.
 */
export const dimmerLevel = (stored: number | null | undefined): number => {
  const level = typeof stored === 'number' && Number.isFinite(stored) ? stored : DIMMER_STANDARD
  return Math.min(DIMMER_STANDARD, Math.max(DIMMER_MIN, level))
}

/** The share of the space's calibrated light the lamps give: 0.5–1. */
export const dimmerFraction = (stored: number | null | undefined): number =>
  dimmerLevel(stored) / DIMMER_STANDARD

/** What the artist reads next to the slider: 50–100. */
export const dimmerPercent = (stored: number | null | undefined): number =>
  Math.round(dimmerFraction(stored) * 100)
