type Rgba = readonly [number, number, number, number]

/** The wall (light gray, ≈ 241) at its corner may dip a hair (soft shadow tails, encoding), not more. */
const MIN_WALL = 232
/** The shot's outer edge must read as the wall: a shadow cut there shows as a dark line. */
export const MIN_EDGE = 237

/**
 * Whether a captured shot is usable: the wall at its corner opaque and light, the artwork's window
 * transparent. Catches a capture taken before anything was drawn (all transparent) and any other
 * broken frame, so a bad shot is reported and retried instead of stored. Returns why it's wrong,
 * or null.
 */
export function checkShot(px: {
  corner: Rgba
  windowCenter: Rgba
  /** The darkest channel along the shot's four outer edges. */
  edgeMin?: number
}): string | null {
  const [r, g, b, a] = px.corner
  if (a === 0) return 'The render came out blank'
  if (a < 255 || Math.min(r, g, b) < MIN_WALL) return 'The wall did not render'
  if (px.windowCenter[3] !== 0) return "The artwork's window is not transparent"
  if (px.edgeMin !== undefined && px.edgeMin < MIN_EDGE) {
    return `A shadow reaches the shot's edge (${px.edgeMin} < ${MIN_EDGE})`
  }
  return null
}

/** A photo view darker than this on average drew nothing (a lost WebGL context). */
const PHOTO_MIN_MEAN = 20
/** A photo view with less spread than this is one flat colour: no paper, table or artwork in it. */
const PHOTO_MIN_SD = 1.5

/**
 * Whether a photo view (2026-11-20) came out wrong, from its luminance (0–255) measured on the
 * photo drawn down: its mean and standard deviation. Returns why, or null.
 */
export function photoProblem(px: { mean: number; sd: number }): string | null {
  if (px.mean < PHOTO_MIN_MEAN) return 'The photo came out black'
  if (px.sd < PHOTO_MIN_SD) return 'The photo came out flat'
  return null
}
