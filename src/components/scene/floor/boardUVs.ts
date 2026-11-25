import { Float32BufferAttribute, Vector3, type BufferGeometry } from 'three'

import { WOOD_TILE_M } from '@/components/scene/spaces/objects/Frame/woodTextures'

/**
 * Wood on a piece of floor furniture (floor composing, 2026-11-25): UVs in tiles of real board
 * (`WOOD_TILE_M`, as the frames, AR-169), planar per triangle by the way it faces, the grain (u)
 * running along the piece's longest side (a standing plank: vertical grain); on the faces across
 * that side, along the longer of their two. Non-indexed geometry (each triangle its own UVs).
 */
export function boardUVs(geometry: BufferGeometry): BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  const pos = g.getAttribute('position')
  g.computeBoundingBox()
  const box = g.boundingBox!
  const ext = [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z]
  const longest = ext.indexOf(Math.max(...ext))
  const uv = new Float32Array(pos.count * 2)
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const ab = new Vector3()
  const ac = new Vector3()
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    const n = ab.subVectors(b, a).cross(ac.subVectors(c, a))
    const abs = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)]
    const facing = abs.indexOf(Math.max(...abs))
    const inPlane = [0, 1, 2].filter((k) => k !== facing)
    const along =
      longest !== facing
        ? longest
        : ext[inPlane[0]] >= ext[inPlane[1]]
          ? inPlane[0]
          : inPlane[1]
    const across = inPlane.find((k) => k !== along)!
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k]
      uv[(i + k) * 2] = p.getComponent(along) / WOOD_TILE_M
      uv[(i + k) * 2 + 1] = p.getComponent(across) / WOOD_TILE_M
    }
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return g
}
