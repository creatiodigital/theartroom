type Rgba = readonly [number, number, number, number]

/** The wall's corner may dip a hair below white (soft shadow tails, encoding), not more. */
const MIN_WALL = 240
/** The shot's outer edge must read as the page's white: a shadow cut there shows as a gray line. */
export const MIN_EDGE = 251

/**
 * Whether a captured shot is usable: the wall at its corner opaque and white, the artwork's window
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
  if (a < 255 || Math.min(r, g, b) < MIN_WALL) return 'The wall did not render white'
  if (px.windowCenter[3] !== 0) return "The artwork's window is not transparent"
  if (px.edgeMin !== undefined && px.edgeMin < MIN_EDGE) {
    return `A shadow reaches the shot's edge (${px.edgeMin} < ${MIN_EDGE})`
  }
  return null
}
