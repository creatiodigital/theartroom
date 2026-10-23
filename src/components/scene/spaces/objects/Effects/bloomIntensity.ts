/**
 * The glow's strength (the bloom note in `Effects.tsx` explains its threshold and what glows).
 * AR-165 (Eduardo 2026-10-23): 0.6 made the windows glow too much — Paris "reduce the glow on the
 * window (not the floor patches)", 0.4, then "still lower it a tad"; Madrid and Vienna then, "same
 * issue". The glow is the camera's, not the room's: the light, the bake and the sun patches are
 * untouched (no re-bake). It is one glow, so the lamp discs glow that much less too.
 */
export const BLOOM_INTENSITY = 0.3
