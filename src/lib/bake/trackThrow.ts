/**
 * A track lamp's throw — the stored `trackLampDistance`, the artist's (AR-161 follow-up, Eduardo
 * 2026-10-20). It is three's SpotLight `distance`: the light fades out smoothly toward it and
 * reaches nothing beyond it. 0 is no cut-off — the inverse square alone, as a real lamp — which
 * every space's approved look was made with and the slider's top position ("No limit").
 *
 * The bake applies three's very window (`SPOT_FRAGMENT` in bakeShaders.ts), so the baked walls
 * and the realtime light on the artworks agree at any throw.
 */
export const TRACK_THROW_NO_LIMIT = 0
export const TRACK_THROW_MIN = 1
export const TRACK_THROW_MAX = 10
export const TRACK_THROW_STEP = 0.5

/** A throw to store: anything not above 0 is no cut-off; otherwise 1–10 m. */
export const clampTrackThrow = (value: number): number =>
  value > 0 ? Math.min(TRACK_THROW_MAX, Math.max(TRACK_THROW_MIN, value)) : TRACK_THROW_NO_LIMIT

/** The slider runs 1–10 m, then one step more: "No limit". */
export const TRACK_THROW_SLIDER_MAX = TRACK_THROW_MAX + TRACK_THROW_STEP

/** Where a stored throw sits on the slider. */
export const throwToSlider = (stored: number): number =>
  stored > 0 ? stored : TRACK_THROW_SLIDER_MAX

/** The throw a slider position stores. */
export const sliderToThrow = (position: number): number =>
  position > TRACK_THROW_MAX ? TRACK_THROW_NO_LIMIT : clampTrackThrow(position)

/** What the artist reads next to the slider. */
export const throwLabel = (stored: number): string =>
  stored > 0 ? `${stored.toFixed(1)}m` : 'No limit'
