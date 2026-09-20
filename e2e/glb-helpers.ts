import fs from 'node:fs'

/**
 * A minimal glTF-binary reader, so a spec can hold a space model to its contract
 * without a browser or a WebGL context.
 *
 * It exists because every way of getting a space GLB wrong fails SILENTLY. Every
 * call site that reads a node is null-guarded, so a re-export that quietly drops
 * `initialPoint0` or renames `panel0` to `panel0.001` throws nothing at all — the
 * prop simply never appears, and nobody notices until an artist does.
 *
 * Only the JSON chunk and vertex positions/normals are parsed. That is enough to
 * check names, parents, placement and facing, and it needs no dependency.
 */

export type GlbNode = {
  name?: string
  mesh?: number
  translation?: [number, number, number]
  scale?: [number, number, number]
  rotation?: [number, number, number, number]
  children?: number[]
}

export type Glb = {
  nodes: GlbNode[]
  meshes: { primitives: { attributes: Record<string, number>; material?: number }[] }[]
  accessors: { bufferView: number; componentType: number; count: number; type: string; byteOffset?: number }[]
  bufferViews: { byteOffset?: number; byteStride?: number }[]
  materials?: unknown[]
}

export type LoadedGlb = {
  json: Glb
  /** Every node name in the file. */
  names: string[]
  /** Parent node name for a given node name, or null at the scene root. */
  parentOf: (name: string) => string | null
  /** World-space AABB, valid because these models use translation-only parents. */
  boxOf: (name: string) => { min: [number, number, number]; max: [number, number, number] } | null
  /** Averaged, normalised vertex normal — which way a placeholder plane faces. */
  normalOf: (name: string) => [number, number, number] | null
  /** True when the node's mesh references a material. */
  hasMaterial: (name: string) => boolean
}

const FLOAT = 5126
const COMPONENT_BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, [FLOAT]: 4 }
const TYPE_COUNT: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }

export const loadGlb = (path: string): LoadedGlb => {
  const buf = fs.readFileSync(path)
  let offset = 12
  let json: Glb | null = null
  let bin: Buffer | null = null

  while (offset < buf.length) {
    const length = buf.readUInt32LE(offset)
    const type = buf.readUInt32LE(offset + 4)
    const chunk = buf.subarray(offset + 8, offset + 8 + length)
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8')) as Glb
    else bin = chunk
    offset += 8 + length
    if (length % 4) offset += 4 - (length % 4)
  }
  if (!json || !bin) throw new Error(`Not a readable GLB: ${path}`)
  const data = bin

  const indexByName = new Map<string, number>()
  json.nodes.forEach((n, i) => {
    if (n.name) indexByName.set(n.name, i)
  })
  const parentIndex = new Map<number, number>()
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentIndex.set(c, i)))

  const readVec3 = (accessorIndex: number): [number, number, number][] => {
    const acc = json!.accessors[accessorIndex]
    const view = json!.bufferViews[acc.bufferView]
    const bytes = COMPONENT_BYTES[acc.componentType]
    const stride = view.byteStride ?? TYPE_COUNT[acc.type] * bytes
    const start = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0)
    const out: [number, number, number][] = []
    for (let e = 0; e < acc.count; e++) {
      const b = start + e * stride
      out.push([data.readFloatLE(b), data.readFloatLE(b + 4), data.readFloatLE(b + 8)])
    }
    return out
  }

  // These models parent props under Empties that only translate, so accumulating
  // translation up the chain gives the true world offset. Assert that, rather
  // than assume it — a rotated Empty would make every box below silently wrong.
  const worldOffset = (index: number): [number, number, number] => {
    let t: [number, number, number] = [0, 0, 0]
    let cur: number | undefined = index
    while (cur !== undefined) {
      const node = json!.nodes[cur]
      const r = node.rotation
      if (r && (r[0] !== 0 || r[1] !== 0 || r[2] !== 0 || Math.abs(r[3]) !== 1)) {
        throw new Error(`glb-helpers: '${node.name}' has a rotated ancestor; boxOf is translation-only`)
      }
      const tr = node.translation ?? [0, 0, 0]
      t = [t[0] + tr[0], t[1] + tr[1], t[2] + tr[2]]
      cur = parentIndex.get(cur)
    }
    return t
  }

  const meshOf = (name: string) => {
    const i = indexByName.get(name)
    if (i === undefined) return null
    const node = json!.nodes[i]
    if (node.mesh === undefined) return null
    return { i, node, prim: json!.meshes[node.mesh].primitives[0] }
  }

  return {
    json,
    names: json.nodes.map((n) => n.name).filter((n): n is string => !!n),
    parentOf: (name) => {
      const i = indexByName.get(name)
      if (i === undefined) return null
      const p = parentIndex.get(i)
      return p === undefined ? null : (json!.nodes[p].name ?? null)
    },
    boxOf: (name) => {
      const m = meshOf(name)
      if (!m) return null
      const off = worldOffset(m.i)
      const scale = m.node.scale ?? [1, 1, 1]
      const min: [number, number, number] = [Infinity, Infinity, Infinity]
      const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
      for (const p of readVec3(m.prim.attributes.POSITION)) {
        for (let k = 0; k < 3; k++) {
          const v = p[k] * scale[k] + off[k]
          if (v < min[k]) min[k] = v
          if (v > max[k]) max[k] = v
        }
      }
      return { min, max }
    },
    normalOf: (name) => {
      const m = meshOf(name)
      if (!m || m.prim.attributes.NORMAL === undefined) return null
      const sum: [number, number, number] = [0, 0, 0]
      const all = readVec3(m.prim.attributes.NORMAL)
      for (const n of all) {
        sum[0] += n[0]
        sum[1] += n[1]
        sum[2] += n[2]
      }
      const len = Math.hypot(...sum)
      if (len === 0) return null
      return [sum[0] / len, sum[1] / len, sum[2] / len]
    },
    hasMaterial: (name) => meshOf(name)?.prim.material !== undefined,
  }
}
