import { BufferAttribute, BufferGeometry, Vector3, type Mesh } from 'three'
import { potpack } from 'three/examples/jsm/libs/potpack.module.js'

/**
 * ⚠️ AR-161 — automatic lightmap UVs for props whose authored UVs were made for tiling
 * (overlapping, repeating), so they cannot hold a bake.
 *
 * Planar charts: triangles that share an edge and face the same way (normals within ~11°) form
 * one chart, projected flat onto its own plane at true scale; charts are packed into one atlas
 * shared by every prop. Texel density is uniform in world space, so a 1 m window frame and a
 * 10 cm socket get the same sharpness.
 *
 * Writes `uv1` on each prop (its geometry is replaced by a non-indexed copy; `restore` puts the
 * original back) and returns one MERGED world-space geometry whose `uv` is that same atlas
 * layout — the bake renders that single proxy instead of every prop separately.
 */

const COPLANAR = 0.98
const PADDING_TEXELS = 3

export interface PropAtlas {
  merged: BufferGeometry
  size: number
  /** Metres per texel actually achieved (the size cap can make it coarser than asked). */
  texel: number
  restore: () => void
}

const key = (v: Vector3) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`

export const buildPropAtlas = (
  meshes: Mesh[],
  texelSize = 0.01,
  maxSize = 1024,
  /** Also write `uv2`: each chart's own plane coordinates in units of this many metres. */
  planarTileMetres?: number,
): PropAtlas => {
  type Tri = { mesh: number; first: number; normal: Vector3; world: Vector3[] }
  const tris: Tri[] = []
  const prepared = meshes.map((mesh, m) => {
    mesh.updateMatrixWorld(true)
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    const pos = geometry.getAttribute('position')
    for (let i = 0; i < pos.count; i += 3) {
      const world = [0, 1, 2].map((k) =>
        new Vector3().fromBufferAttribute(pos, i + k).applyMatrix4(mesh.matrixWorld),
      )
      const normal = world[1]!.clone().sub(world[0]!).cross(world[2]!.clone().sub(world[0]!))
      if (normal.lengthSq() === 0) normal.set(0, 1, 0)
      tris.push({ mesh: m, first: i, normal: normal.normalize(), world })
    }
    return { mesh, geometry, original: mesh.geometry }
  })

  // Union-find: shared edge (by world position) + same facing.
  const parent = tris.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  const edges = new Map<string, number>()
  tris.forEach((t, i) => {
    for (let e = 0; e < 3; e++) {
      const a = key(t.world[e]!)
      const b = key(t.world[(e + 1) % 3]!)
      const edge = a < b ? `${a}|${b}` : `${b}|${a}`
      const other = edges.get(edge)
      if (other === undefined) {
        edges.set(edge, i)
      } else if (tris[other]!.mesh === t.mesh && tris[other]!.normal.dot(t.normal) > COPLANAR) {
        parent[find(i)] = find(other)
      }
    }
  })

  // Project each chart onto its plane, in metres.
  type Chart = {
    tris: number[]
    u: Vector3
    v: Vector3
    min: [number, number]
    w: number
    h: number
  }
  const charts = new Map<number, Chart>()
  tris.forEach((_, i) => {
    const root = find(i)
    if (!charts.has(root))
      charts.set(root, { tris: [], u: new Vector3(), v: new Vector3(), min: [0, 0], w: 0, h: 0 })
    charts.get(root)!.tris.push(i)
  })
  const padding = PADDING_TEXELS * texelSize
  const boxes: { w: number; h: number; x: number; y: number; chart: Chart }[] = []
  charts.forEach((chart) => {
    const n = chart.tris.reduce((acc, i) => acc.add(tris[i]!.normal), new Vector3()).normalize()
    const helper = Math.abs(n.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
    chart.u = helper.clone().cross(n).normalize()
    chart.v = n.clone().cross(chart.u).normalize()
    let minU = Infinity,
      minV = Infinity,
      maxU = -Infinity,
      maxV = -Infinity
    for (const i of chart.tris) {
      for (const p of tris[i]!.world) {
        const pu = p.dot(chart.u)
        const pv = p.dot(chart.v)
        minU = Math.min(minU, pu)
        maxU = Math.max(maxU, pu)
        minV = Math.min(minV, pv)
        maxV = Math.max(maxV, pv)
      }
    }
    chart.min = [minU, minV]
    chart.w = maxU - minU
    chart.h = maxV - minV
    boxes.push({ w: chart.w + padding * 2, h: chart.h + padding * 2, x: 0, y: 0, chart })
  })
  const packed = potpack(boxes)
  // Chart id per triangle: the final gather decides which side faces the room per chart.
  const chartOf = new Int32Array(tris.length)
  boxes.forEach((box, k) => box.chart.tris.forEach((i) => (chartOf[i] = k)))
  const extent = Math.max(packed.w, packed.h)
  const size = Math.min(maxSize, 2 ** Math.ceil(Math.log2(Math.max(64, extent / texelSize))))

  // Write uv1 on each prop and the merged proxy's uv.
  const uv1 = prepared.map((p) => new Float32Array(p.geometry.getAttribute('position').count * 2))
  // Real-world planar coordinates per chart (for tiling a material at true scale).
  const uv2 = planarTileMetres
    ? prepared.map((p) => new Float32Array(p.geometry.getAttribute('position').count * 2))
    : null
  for (const box of boxes) {
    const c = box.chart
    for (const i of c.tris) {
      const t = tris[i]!
      t.world.forEach((p, k) => {
        const u = (p.dot(c.u) - c.min[0] + box.x + padding) / extent
        const v = (p.dot(c.v) - c.min[1] + box.y + padding) / extent
        uv1[t.mesh]![(t.first + k) * 2] = u
        uv1[t.mesh]![(t.first + k) * 2 + 1] = v
        if (uv2 && planarTileMetres) {
          uv2[t.mesh]![(t.first + k) * 2] = p.dot(c.u) / planarTileMetres
          uv2[t.mesh]![(t.first + k) * 2 + 1] = p.dot(c.v) / planarTileMetres
        }
      })
    }
  }

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const chartIds: number[] = []
  prepared.forEach((p, m) => {
    p.geometry.setAttribute('uv1', new BufferAttribute(uv1[m]!, 2))
    if (uv2) p.geometry.setAttribute('uv2', new BufferAttribute(uv2[m]!, 2))
    p.mesh.geometry = p.geometry
    tris.forEach((t, ti) => {
      if (t.mesh !== m) return
      {
        t.world.forEach((w, k) => {
          chartIds.push(chartOf[ti]!)
          positions.push(w.x, w.y, w.z)
          normals.push(t.normal.x, t.normal.y, t.normal.z)
          uvs.push(uv1[m]![(t.first + k) * 2]!, uv1[m]![(t.first + k) * 2 + 1]!)
        })
      }
    })
  })
  const merged = new BufferGeometry()
  merged.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  merged.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  merged.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  merged.setAttribute('chart', new BufferAttribute(new Float32Array(chartIds), 1))

  return {
    merged,
    size,
    texel: extent / size,
    restore: () => {
      prepared.forEach((p) => {
        p.mesh.geometry = p.original
        p.geometry.dispose()
      })
      merged.dispose()
    },
  }
}
