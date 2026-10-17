import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  NearestFilter,
  RGBAFormat,
  Vector3,
  type BufferGeometry,
  type Color,
  type Matrix4,
} from 'three'

/**
 * ⚠️ AR-161 SPIKE — the room as ray-traceable data for the final gather: every triangle that
 * can be seen from a lightmap texel, in a BVH, packed into two float textures the gather shader
 * walks with `texelFetch`.
 *
 * Each triangle knows what a ray that hits it sees:
 *  - kind 0, a lightmapped receiver: albedo × the bake's irradiance at the hit's lightmap UV / π;
 *  - kind 1, everything else (frames, panels, lamp-less props): a constant radiance;
 *  - kind 2, an emitter (window glass): its daylight radiance.
 *
 * Layouts (RGBA float, rows of TEX_WIDTH texels), triangles stored in BVH leaf order:
 *   triangle i, texels 6i…6i+5: [v0, kind] [v1 − v0, slot] [v2 − v0, coverage] [uv0, uv1]
 *                               [uv2, 0, 0] [albedo or radiance, 0]
 *   node j, texels 2j, 2j+1: [min, count] [max, count > 0 ? firstTriangle : rightChild]
 *   (inner nodes: count 0, left child = j + 1 — depth-first order).
 */

export const TEX_WIDTH = 2048
const LEAF_SIZE = 4

export const enum TriangleKind {
  Receiver = 0,
  Constant = 1,
  Emitter = 2,
}

export interface GatherSource {
  geometry: BufferGeometry
  matrixWorld: Matrix4
  kind: TriangleKind
  /** Receiver lightmap slot (kind 0). */
  slot?: number
  /** Albedo (kind 0) or radiance (kinds 1, 2), linear. */
  color: Color
  /**
   * Fraction of rays the surface stops (its material opacity), 1 by default. Three draws an
   * 80%-opaque panel as 80% panel over 20% of what is behind it; light passes it the same way.
   */
  coverage?: number
}

export interface GatherScene {
  triangles: DataTexture
  nodes: DataTexture
  triangleCount: number
  nodeCount: number
  depth: number
}

const texture = (data: Float32Array, texels: number) => {
  const height = Math.max(1, Math.ceil(texels / TEX_WIDTH))
  const padded = new Float32Array(TEX_WIDTH * height * 4)
  padded.set(data)
  const t = new DataTexture(padded, TEX_WIDTH, height, RGBAFormat, FloatType)
  t.minFilter = t.magFilter = NearestFilter
  t.wrapS = t.wrapT = ClampToEdgeWrapping
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
}

export const buildGatherScene = (sources: GatherSource[]): GatherScene => {
  // Flatten every source into world-space triangles.
  const v = new Vector3()
  const tris: {
    a: Vector3
    b: Vector3
    c: Vector3
    uv: number[]
    kind: number
    slot: number
    color: Color
    coverage: number
    centroid: Vector3
  }[] = []
  for (const s of sources) {
    const pos = s.geometry.getAttribute('position')
    if (!pos) continue
    const uv = s.geometry.getAttribute('uv')
    const index = s.geometry.getIndex()
    const count = index ? index.count : pos.count
    for (let i = 0; i + 2 < count; i += 3) {
      const ids = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k))
      const [a, b, c] = ids.map((id) =>
        v.fromBufferAttribute(pos, id).clone().applyMatrix4(s.matrixWorld),
      )
      tris.push({
        a: a!,
        b: b!,
        c: c!,
        uv: ids.flatMap((id) => (uv ? [uv.getX(id), uv.getY(id)] : [0, 0])),
        kind: s.kind,
        slot: s.slot ?? 0,
        color: s.color,
        coverage: s.coverage ?? 1,
        centroid: a!.clone().add(b!).add(c!).divideScalar(3),
      })
    }
  }

  // BVH: median split on the longest axis of the centroids' bounds, depth-first layout.
  const order = tris.map((_, i) => i)
  const nodes: number[] = []
  let depth = 0
  const build = (start: number, end: number, level: number): number => {
    depth = Math.max(depth, level)
    const nodeIndex = nodes.length / 8
    nodes.push(0, 0, 0, 0, 0, 0, 0, 0)
    const min = new Vector3(Infinity, Infinity, Infinity)
    const max = new Vector3(-Infinity, -Infinity, -Infinity)
    const cmin = min.clone()
    const cmax = max.clone()
    for (let i = start; i < end; i++) {
      const t = tris[order[i]!]!
      for (const p of [t.a, t.b, t.c]) {
        min.min(p)
        max.max(p)
      }
      cmin.min(t.centroid)
      cmax.max(t.centroid)
    }
    // A hair of padding so axis-aligned (flat) boxes still intersect.
    min.subScalar(1e-4)
    max.addScalar(1e-4)
    const o = nodeIndex * 8
    nodes[o] = min.x
    nodes[o + 1] = min.y
    nodes[o + 2] = min.z
    nodes[o + 4] = max.x
    nodes[o + 5] = max.y
    nodes[o + 6] = max.z
    const count = end - start
    const extent = cmax.clone().sub(cmin)
    if (count <= LEAF_SIZE || Math.max(extent.x, extent.y, extent.z) < 1e-6) {
      nodes[o + 3] = count
      nodes[o + 7] = start
      return nodeIndex
    }
    const axis = extent.x > extent.y && extent.x > extent.z ? 'x' : extent.y > extent.z ? 'y' : 'z'
    const slice = order
      .slice(start, end)
      .sort((i, j) => tris[i]!.centroid[axis] - tris[j]!.centroid[axis])
    for (let i = 0; i < slice.length; i++) order[start + i] = slice[i]!
    const mid = start + (count >> 1)
    build(start, mid, level + 1) // left child = nodeIndex + 1
    const right = build(mid, end, level + 1)
    nodes[o + 3] = 0
    nodes[o + 7] = right
    return nodeIndex
  }
  if (tris.length) build(0, tris.length, 0)

  const triData = new Float32Array(tris.length * 6 * 4)
  order.forEach((ti, i) => {
    const t = tris[ti]!
    const e1 = t.b.clone().sub(t.a)
    const e2 = t.c.clone().sub(t.a)
    triData.set(
      [
        t.a.x,
        t.a.y,
        t.a.z,
        t.kind,
        e1.x,
        e1.y,
        e1.z,
        t.slot,
        e2.x,
        e2.y,
        e2.z,
        t.coverage,
        t.uv[0]!,
        t.uv[1]!,
        t.uv[2]!,
        t.uv[3]!,
        t.uv[4]!,
        t.uv[5]!,
        0,
        0,
        t.color.r,
        t.color.g,
        t.color.b,
        0,
      ],
      i * 24,
    )
  })

  return {
    triangles: texture(triData, tris.length * 6),
    nodes: texture(new Float32Array(nodes), nodes.length / 4),
    triangleCount: tris.length,
    nodeCount: nodes.length / 8,
    depth,
  }
}
