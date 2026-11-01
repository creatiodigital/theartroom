import {
  Box3,
  ClampToEdgeWrapping,
  DataTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  RGFormat,
  Vector2,
  Vector3,
  Vector4,
  type Mesh,
  type Object3D,
} from 'three'

import { BAKE_DEBUG } from './bakedLook'

/**
 * ⚠️ AR-169 trial (`?fillnear=1`, development and staging) — Eduardo 2026-11-01: "Vienna soft-fill
 * tilt: today it uses one direction per space, which is wrong in Vienna room 0. Make each surface
 * lean toward its nearest window (or no tilt where the windows disagree)."
 *
 * The soft fill leans every surface toward the windows (`softFill.ts`, `WINDOW_FILL_TILT`) with ONE
 * direction per space: the area-weighted mean of every pane. Where a space's panes face different
 * ways (Vienna: room 0's +z, room 1's two +x → mean (0.90, 0.44)) every room leans a wrong way.
 * This field gives each point of the plan its own direction: every pane's, weighted by its area ×
 * `exp(−walk / FIELD_REACH)`, the walk measured through the doors and around the walls (a straight
 * line would let room 1's windows reach room 0's far corner through two walls). Inside a room its
 * own windows win; between rooms whose windows disagree the directions cancel toward no tilt.
 * Keyed on the model (the panes `windowGlass{i}`, the shell `wall0`), never on the space: a space
 * whose panes all face one way (Paris, Madrid) gets no field and keeps its one direction.
 */
export const fillNearFlag = (): boolean =>
  BAKE_DEBUG &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('fillnear') === '1'

/** The plan's cell (m). */
const FIELD_CELL = 0.25
/** Where the plan cuts the shell (m above its foot): over the window sills, under the door heads. */
const FIELD_HEIGHT = 1.2
/** The walk (m) over which a farther pane's weight falls by e: a room's own windows win inside it. */
const FIELD_REACH = 1
/** Panes this close in direction (cos 5°) agree: the space keeps one direction, no field. */
const PANES_AGREE = Math.cos((5 * Math.PI) / 180)

/** The field as the shaders read it: the plan's directions and where the plan lies. */
export interface FillField {
  texture: DataTexture
  /** x0, z0, 1 / width, 1 / depth (m): world xz → the texture's uv. */
  bounds: Vector4
}

/** A window pane on the plan: where its daylight travels (unit), its area, its two ends. */
interface Pane {
  d: Vector2
  area: number
  a: Vector2
  b: Vector2
}

/** Every `windowGlass{i}`, faced as the bake's emitters face (`windowFillDirection`). */
const panesOf = (scene: Object3D): Pane[] => {
  const panes: Pane[] = []
  const [a, b, c, ab, ac] = [0, 1, 2, 3, 4].map(() => new Vector3()) as Vector3[]
  scene.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || !/^windowGlass\d+$/.test(mesh.name)) return
    mesh.updateWorldMatrix(true, false)
    const flip = mesh.matrixWorld.determinant() < 0 ? -1 : 1
    const pos = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    const count = index ? index.count : pos.count
    const at = (i: number) => (index ? index.getX(i) : i)
    const sum = new Vector3()
    const plan: Vector2[] = []
    let area = 0
    for (let i = 0; i + 2 < count; i += 3) {
      a!.fromBufferAttribute(pos, at(i)).applyMatrix4(mesh.matrixWorld)
      b!.fromBufferAttribute(pos, at(i + 1)).applyMatrix4(mesh.matrixWorld)
      c!.fromBufferAttribute(pos, at(i + 2)).applyMatrix4(mesh.matrixWorld)
      ab!.subVectors(b!, a!).cross(ac!.subVectors(c!, a!))
      sum.addScaledVector(ab!, flip)
      area += ab!.length() / 2
      for (const p of [a!, b!, c!]) plan.push(new Vector2(p.x, p.z))
    }
    const d = new Vector2(sum.x, sum.z)
    if (d.lengthSq() < 1e-8 || plan.length === 0) return
    d.normalize()
    // Its ends: the farthest points along the pane, on the line through its middle.
    const mid = plan.reduce((m, p) => m.add(p), new Vector2()).divideScalar(plan.length)
    const along = new Vector2(-d.y, d.x)
    const s = plan.map((p) => along.dot(p.clone().sub(mid)))
    panes.push({
      d,
      area,
      a: mid.clone().addScaledVector(along, Math.min(...s)),
      b: mid.clone().addScaledVector(along, Math.max(...s)),
    })
  })
  return panes
}

/** A binary min-heap of grid cells by walk (Dijkstra's frontier). */
class Frontier {
  private cells: number[] = []
  constructor(private readonly walk: Float32Array) {}
  get size() {
    return this.cells.length
  }
  push(cell: number) {
    const { cells, walk } = this
    cells.push(cell)
    let i = cells.length - 1
    while (i > 0) {
      const up = (i - 1) >> 1
      if (walk[cells[up]!]! <= walk[cell]!) break
      cells[i] = cells[up]!
      i = up
    }
    cells[i] = cell
  }
  pop(): number {
    const { cells, walk } = this
    const top = cells[0]!
    const last = cells.pop()!
    if (cells.length === 0) return top
    let i = 0
    for (;;) {
      const l = 2 * i + 1
      if (l >= cells.length) break
      const r = l + 1
      const child = r < cells.length && walk[cells[r]!]! < walk[cells[l]!]! ? r : l
      if (walk[cells[child]!]! >= walk[last]!) break
      cells[i] = cells[child]!
      i = child
    }
    cells[i] = last
    return top
  }
}

/**
 * The plan's field of window directions, or null: no windows, no shell, or every pane facing one
 * way (the space keeps one direction). Built once per room, on the CPU (a few tens of ms).
 */
export const windowFillField = (scene: Object3D): FillField | null => {
  const started = performance.now()
  const panes = panesOf(scene)
  const wall = scene.getObjectByName('wall0') as Mesh | undefined
  if (panes.length < 2 || !wall?.isMesh) return null
  const total = panes.reduce((m, p) => m.addScaledVector(p.d, p.area), new Vector2()).normalize()
  if (panes.every((p) => p.d.dot(total) >= PANES_AGREE)) return null

  // The plan: the shell's footprint, a cell of margin round it.
  wall.updateWorldMatrix(true, false)
  const box = new Box3().setFromObject(wall)
  const x0 = box.min.x - FIELD_CELL
  const z0 = box.min.z - FIELD_CELL
  const width = Math.ceil((box.max.x - box.min.x) / FIELD_CELL) + 2
  const depth = Math.ceil((box.max.z - box.min.z) / FIELD_CELL) + 2
  const cells = width * depth
  const cellOf = (x: number, z: number) => {
    const i = Math.floor((x - x0) / FIELD_CELL)
    const k = Math.floor((z - z0) / FIELD_CELL)
    return i >= 0 && i < width && k >= 0 && k < depth ? k * width + i : -1
  }

  // Walls: the shell cut at FIELD_HEIGHT; the panes too (no walk out through a window and back in).
  const blocked = new Uint8Array(cells)
  const mark = (ax: number, az: number, bx: number, bz: number) => {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (FIELD_CELL / 4)) + 1
    for (let s = 0; s <= steps; s++) {
      const cell = cellOf(ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps)
      if (cell >= 0) blocked[cell] = 1
    }
  }
  const cut = box.min.y + FIELD_HEIGHT
  const pos = wall.geometry.getAttribute('position')
  const index = wall.geometry.getIndex()
  const count = index ? index.count : pos.count
  const at = (i: number) => (index ? index.getX(i) : i)
  const corner = [0, 1, 2].map(() => new Vector3())
  const crossing: Vector2[] = []
  for (let i = 0; i + 2 < count; i += 3) {
    corner.forEach((v, k) => v.fromBufferAttribute(pos, at(i + k)).applyMatrix4(wall.matrixWorld))
    crossing.length = 0
    for (let k = 0; k < 3; k++) {
      const p = corner[k]!
      const q = corner[(k + 1) % 3]!
      if ((p.y - cut) * (q.y - cut) >= 0) continue
      const t = (cut - p.y) / (q.y - p.y)
      crossing.push(new Vector2(p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t))
    }
    if (crossing.length === 2) mark(crossing[0]!.x, crossing[0]!.y, crossing[1]!.x, crossing[1]!.y)
  }
  panes.forEach((p) => mark(p.a.x, p.a.y, p.b.x, p.b.y))

  // Each pane's walk to every cell (Dijkstra, 8 neighbours, no corner cutting past a wall), from
  // the cells just inside its glass.
  const step = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ] as const
  const walks = panes.map((pane) => {
    const walk = new Float32Array(cells).fill(Infinity)
    const frontier = new Frontier(walk)
    const length = pane.a.distanceTo(pane.b)
    const seeds = Math.max(1, Math.ceil(length / (FIELD_CELL / 2)))
    for (let s = 0; s <= seeds; s++) {
      const p = pane.a
        .clone()
        .lerp(pane.b, s / seeds)
        .addScaledVector(pane.d, FIELD_CELL * 1.5)
      const cell = cellOf(p.x, p.y)
      if (cell < 0 || blocked[cell] || walk[cell] === 0) continue
      walk[cell] = 0
      frontier.push(cell)
    }
    while (frontier.size > 0) {
      const cell = frontier.pop()
      const i = cell % width
      const k = (cell - i) / width
      for (const [di, dk, cost] of step) {
        const ni = i + di
        const nk = k + dk
        if (ni < 0 || ni >= width || nk < 0 || nk >= depth) continue
        const next = nk * width + ni
        if (blocked[next]) continue
        if (di !== 0 && dk !== 0 && (blocked[k * width + ni] || blocked[nk * width + i])) continue
        const reach = walk[cell]! + cost * FIELD_CELL
        if (reach >= walk[next]!) continue
        walk[next] = reach
        frontier.push(next)
      }
    }
    return walk
  })

  // Each cell: the panes' directions, weighted by area × exp(−walk / FIELD_REACH) — the nearest
  // counted from 1 (no underflow far from every window). Cells no pane reaches lean nowhere.
  const field = new Float32Array(cells * 2)
  let reached = 0
  for (let cell = 0; cell < cells; cell++) {
    if (blocked[cell]) continue
    const nearest = Math.min(...walks.map((w) => w[cell]!))
    if (!Number.isFinite(nearest)) continue
    let wx = 0
    let wz = 0
    let weight = 0
    panes.forEach((pane, p) => {
      const w = pane.area * Math.exp(-(walks[p]![cell]! - nearest) / FIELD_REACH)
      wx += w * pane.d.x
      wz += w * pane.d.y
      weight += w
    })
    field[cell * 2] = wx / weight
    field[cell * 2 + 1] = wz / weight
    reached++
  }
  // A wall's cells take their free neighbours' mean: a surface's sample filters across them.
  for (let pass = 0; pass < 2; pass++) {
    const filled: [number, number, number][] = []
    for (let cell = 0; cell < cells; cell++) {
      if (!blocked[cell]) continue
      const i = cell % width
      const k = (cell - i) / width
      let sx = 0
      let sz = 0
      let n = 0
      for (const [di, dk] of step) {
        const ni = i + di
        const nk = k + dk
        if (ni < 0 || ni >= width || nk < 0 || nk >= depth) continue
        const next = nk * width + ni
        if (blocked[next]) continue
        sx += field[next * 2]!
        sz += field[next * 2 + 1]!
        n++
      }
      if (n > 0) filled.push([cell, sx / n, sz / n])
    }
    for (const [cell, x, z] of filled) {
      field[cell * 2] = x
      field[cell * 2 + 1] = z
      blocked[cell] = 0
    }
  }

  const half = new Uint16Array(cells * 2)
  for (let k = 0; k < half.length; k++) half[k] = DataUtils.toHalfFloat(field[k]!)
  const texture = new DataTexture(half, width, depth, RGFormat, HalfFloatType)
  texture.magFilter = texture.minFilter = LinearFilter
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true
  if (BAKE_DEBUG) {
    Object.assign(window, { __ar169FillField: { x0, z0, cell: FIELD_CELL, width, depth, field } })
    console.info(
      '[AR-169 fill field]',
      JSON.stringify({
        panes: panes.map((p) => ({
          d: [+p.d.x.toFixed(3), +p.d.y.toFixed(3)],
          area: +p.area.toFixed(2),
        })),
        grid: [width, depth],
        reached,
        ms: Math.round(performance.now() - started),
      }),
    )
  }
  return {
    texture,
    bounds: new Vector4(x0, z0, 1 / (width * FIELD_CELL), 1 / (depth * FIELD_CELL)),
  }
}
