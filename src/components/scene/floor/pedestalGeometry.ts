import {
  BoxGeometry,
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
  ShapeUtils,
  Vector2,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import {
  EDGE_RADIUS,
  pedestalOutline,
  STEP,
  TABLE,
  TAPER,
  type PedestalEdges,
  type PedestalShapeId,
} from '@/lib/floor/pedestals'

/**
 * A pedestal's mesh (docs/objects O6, objects-pedestals.dc.html), in metres, standing on y = 0 and
 * centred on x/z. Built from the same outlines the plan and the snapping use (`lib/floor/pedestals`).
 * Plan z (depth) maps to the scene's z.
 */

const CM = 0.01

/** The outline's signed area in plan (x, z): positive for the order every other outline uses. */
const signedArea = (pts: [number, number][]) =>
  pts.reduce((sum, [x, z], i) => {
    const [nx, nz] = pts[(i + 1) % pts.length]
    return sum + x * nz - nx * z
  }, 0) / 2

/** A straight (or tapered) prism over an outline (cm), from y0 to y1 (m), its top scaled. */
function prism(raw: [number, number][], y0: number, y1: number, topScale = 1): BufferGeometry {
  // One winding for all, so the sides face out (Half round's outline runs the other way).
  const outline = signedArea(raw) < 0 ? [...raw].reverse() : raw
  const n = outline.length
  const positions: number[] = []
  const pt = (i: number, top: boolean): [number, number, number] => {
    const [x, z] = outline[i % n]
    const s = top ? topScale : 1
    return [x * CM * s, top ? y1 : y0, z * CM * s]
  }
  for (let i = 0; i < n; i++) {
    const a0 = pt(i, false)
    const b0 = pt(i + 1, false)
    const a1 = pt(i, true)
    const b1 = pt(i + 1, true)
    positions.push(...a0, ...a1, ...b0, ...b0, ...a1, ...b1)
  }
  // Caps, each triangle turned to face up (top) or down (bottom) whatever the triangulator's order.
  const contour = outline.map(([x, z]) => new Vector2(x, z))
  const facingUp = (a: number, b: number, c: number) => {
    const [ax, az] = outline[a]
    const [bx, bz] = outline[b]
    const [cx, cz] = outline[c]
    // y of (b − a) × (c − a) for points (x, 0, z).
    return (bz - az) * (cx - ax) - (bx - ax) * (cz - az) > 0
  }
  for (const [a, b, c] of ShapeUtils.triangulateShape(contour, [])) {
    const [u, v] = facingUp(a, b, c) ? [b, c] : [c, b]
    positions.push(...pt(a, true), ...pt(u, true), ...pt(v, true))
    positions.push(...pt(a, false), ...pt(v, false), ...pt(u, false))
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** A straight prism with bevelled edges (ExtrudeGeometry), kept within its outline. */
function bevelled(outline: [number, number][], h: number, radiusCm: number): BufferGeometry {
  if (radiusCm <= 0) return prism(outline, 0, h * CM)
  // Shrink the outline by the bevel so the bevel brings it back to its size.
  const xs = outline.map(([x]) => x)
  const zs = outline.map(([, z]) => z)
  const w = Math.max(...xs) - Math.min(...xs)
  const d = Math.max(...zs) - Math.min(...zs)
  const r = Math.min(radiusCm, w / 4, d / 4, h / 4)
  const sx = (w - 2 * r) / w
  const sz = (d - 2 * r) / d
  const shape = new Shape(outline.map(([x, z]) => new Vector2(x * sx * CM, -z * sz * CM)))
  const geometry = new ExtrudeGeometry(shape, {
    depth: (h - 2 * r) * CM,
    bevelEnabled: true,
    bevelSize: r * CM,
    bevelThickness: r * CM,
    bevelSegments: radiusCm >= 2 ? 4 : 2,
    curveSegments: 12,
  })
  // Extruded along +z: stand it up (z → y), its base on y = 0.
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, r * CM, 0)
  return geometry
}

export function pedestalGeometry(
  shape: PedestalShapeId,
  w: number,
  d: number,
  h: number,
  edges: PedestalEdges,
): BufferGeometry {
  const radius = EDGE_RADIUS[edges]
  switch (shape) {
    case 'tapered':
    case 'taperedRound':
      return prism(pedestalOutline(shape, w, d), 0, h * CM, TAPER)
    case 'stepped': {
      const at = h * STEP.at
      const base = bevelled(pedestalOutline('box', w, d), at, radius)
      const top = bevelled(pedestalOutline('box', w * STEP.top, d * STEP.top), h - at, radius)
      top.translate(0, at * CM, 0)
      return mergeGeometries([toNonIndexed(base), toNonIndexed(top)])!
    }
    case 'table': {
      const top = new BoxGeometry(w * CM, TABLE.top * CM, d * CM)
      top.translate(0, (h - TABLE.top / 2) * CM, 0)
      const legH = h - TABLE.top
      const inset = TABLE.leg * 1.5
      const legs = [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]) => {
        const leg = new BoxGeometry(TABLE.leg * CM, legH * CM, TABLE.leg * CM)
        leg.translate(
          ((sx * (w / 2 - inset)) as number) * CM,
          (legH / 2) * CM,
          sz * (d / 2 - inset) * CM,
        )
        return leg
      })
      return mergeGeometries([top, ...legs].map(toNonIndexed))!
    }
    default:
      return bevelled(pedestalOutline(shape, w, d), h, radius)
  }
}

const toNonIndexed = (g: BufferGeometry) => {
  const out = g.index ? g.toNonIndexed() : g
  // Merging needs the same attributes everywhere: keep position and normal only.
  for (const name of Object.keys(out.attributes)) {
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name)
  }
  if (!out.attributes.normal) out.computeVertexNormals()
  return out
}
