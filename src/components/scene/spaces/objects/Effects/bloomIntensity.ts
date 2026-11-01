/**
 * The glow's strength (the bloom note in `Effects.tsx` explains its threshold and what glows).
 * AR-165 (Eduardo 2026-10-23): 0.6 made the windows glow too much — Paris "reduce the glow on the
 * window (not the floor patches)", 0.4, then "still lower it a tad"; Madrid and Vienna then, "same
 * issue". The glow is the camera's, not the room's: the light, the bake and the sun patches are
 * untouched (no re-bake). It is one glow, so the lamp discs glow that much less too.
 */
export const BLOOM_INTENSITY = 0.3

/**
 * AR-169 phase 8 (Eduardo's approved look, 2026-10-30): in a baked room only the lamps' bulbs glow.
 * Their brightness and the bloom threshold are both × this (the intensity ÷ it): a bulb's glow,
 * (its brightness − threshold) × intensity, is unchanged, while the window (≈ 2.8 before the
 * camera) and a sun patch on the oak (≈ 6.3) fall below the threshold and stay crisp. Today's
 * look (unbaked) keeps 1.
 */
const LAMP_GLOW_SCALE = 8

export const lampGlowScale = (baked: boolean): number => (baked ? LAMP_GLOW_SCALE : 1)

/**
 * AR-169 (Eduardo 2026-10-29: "decrease the bloom effect on the windows, it's too bright — do not
 * decrease the light patches"): on screen the glass shows this share of the daylight it let in.
 * At full daylight (the bake's 6× its display value) it sits far over the glow threshold and
 * flares; at a third it still reads white, with a tenth of the glow. Only what the camera shows:
 * the bake lights the room, and the sun patches, with the full daylight as before (`bakeJob`).
 * Then (paris23's taller window): "decrease the bloom a bit, I can barely see the window bars" —
 * a sixth. Over the threshold the whole glass feeds the glow, so half the glass is half the glow;
 * after the camera's exposure the glass is still past white. (The daylight itself was 6× then;
 * AR-169's approved look halved it, `daylightGain` 3, on the glass too. The lamps-only bloom,
 * `lampGlowScale`, now keeps the glass from glowing at all.)
 */
export const GLASS_ON_SCREEN = 1 / 6
