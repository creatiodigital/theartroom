import { Color } from 'three'

import { luminance } from './meter'

/**
 * ⚠️ AR-165 — what the floor bounces onto the room: its own color carries only `share` of its
 * chroma, at the same brightness. Eduardo 2026-10-23: "the floor color is affecting too much the
 * overall color on the walls and ceiling … just reduce its influence" — with downlights the floor
 * lights most of the ceiling and the upper walls, so a warm wood floor turned the room beige.
 * The floor itself (its texture and tint) and the room's light level are untouched; 1 is the
 * physical bounce, 0 a grey of the same brightness.
 */
export const floorBounceAlbedo = (albedo: Color, share: number): Color => {
  const grey = luminance(albedo)
  return new Color(grey, grey, grey).lerp(albedo, share)
}
