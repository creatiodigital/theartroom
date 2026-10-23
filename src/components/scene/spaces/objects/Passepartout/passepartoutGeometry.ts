import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'

/**
 * AR-165 — one strip of a passepartout, cut like a real one: mitered at 45° at both ends, and its
 * window bevel-cut through the board, so the bevel shows from the front as a strip around the
 * picture (Eduardo 2026-10-23: the flat, exactly-colored passepartout "lost all 3D
 * dimensionality"). Split in two: `face`, the front face (in the baked look half its own color,
 * `createArtworkSurfaceMaterial`), and `body`, the bevel, the outer edge, the miters and the back
 * (lit by the room).
 *
 * The strip's outer edge runs along x at y = 0, `length` long; the window lies toward −y,
 * `border` in at the back — the picture shows exactly as much as with a straight cut — and the
 * bevel's width more at the front. The board is `depth` thick, centred on z = 0, front at +z.
 */

/**
 * The widest bevel: a thick museum board's (a real one is 1.5–3 mm). At the stored default
 * thickness (0.6 cm) a 45° cut showed a 6 mm strip — Eduardo 2026-10-23: "it looks way thicker".
 * A thicker board is cut steeper; its thickness still sets how far the passepartout stands off the
 * picture.
 */
const BEVEL_MAX = 0.003

/**
 * The bevel's width at the front: the board's thickness (45°) up to BEVEL_MAX, never most of the
 * border.
 */
export const bevelWidth = (border: number, depth: number) =>
  Math.min(depth, BEVEL_MAX, border * 0.9)

type Quad = [Vector3, Vector3, Vector3, Vector3]

/** Flat-shaded triangles of quads given counter-clockwise as seen from outside. */
const flat = (quads: Quad[]): BufferGeometry => {
  const positions: number[] = []
  const normals: number[] = []
  for (const [a, b, c, d] of quads) {
    for (const [p, q, r] of [
      [a, b, c],
      [a, c, d],
    ] as const) {
      const normal = q.clone().sub(p).cross(r.clone().sub(p)).normalize()
      for (const v of [p, q, r]) {
        positions.push(v.x, v.y, v.z)
        normals.push(normal.x, normal.y, normal.z)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  return geometry
}

export const createPassepartoutPiece = (
  length: number,
  border: number,
  depth: number,
): { face: BufferGeometry; body: BufferGeometry } => {
  const half = length / 2
  const z = depth / 2
  const bevel = bevelWidth(border, depth)
  const v = (x: number, y: number, zz: number) => new Vector3(x, y, zz)

  // Back: the outer edge, and the window's edge where the picture shows.
  const backOuterLeft = v(-half, 0, -z)
  const backOuterRight = v(half, 0, -z)
  const backInnerRight = v(half - border, -border, -z)
  const backInnerLeft = v(-half + border, -border, -z)
  // Front: the same outer edge; the window opens by the bevel.
  const frontOuterLeft = v(-half, 0, z)
  const frontOuterRight = v(half, 0, z)
  const frontInnerRight = v(half - border + bevel, -border + bevel, z)
  const frontInnerLeft = v(-half + border - bevel, -border + bevel, z)

  const face = flat([[frontOuterLeft, frontInnerLeft, frontInnerRight, frontOuterRight]])
  const body = flat([
    // The bevel.
    [backInnerLeft, backInnerRight, frontInnerRight, frontInnerLeft],
    // The outer edge (under the frame's lip).
    [backOuterLeft, frontOuterLeft, frontOuterRight, backOuterRight],
    // The miters, where the strip meets the next one.
    [backOuterRight, frontOuterRight, frontInnerRight, backInnerRight],
    [backOuterLeft, backInnerLeft, frontInnerLeft, frontOuterLeft],
    // The back, against the picture.
    [backOuterLeft, backOuterRight, backInnerRight, backInnerLeft],
  ])
  return { face, body }
}
