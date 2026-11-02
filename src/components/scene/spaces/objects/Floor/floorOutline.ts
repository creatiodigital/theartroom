import { BufferAttribute, BufferGeometry, type Mesh } from 'three'

/** The floor's plane as the spaces draw it: centre, surface height and size from `floor0`'s bounds. */
export interface FloorPlane {
  center: [number, number]
  surfaceY: number
  width: number
  depth: number
}

export const floorPlane = (floor: Mesh): FloorPlane => {
  floor.geometry.computeBoundingBox()
  const bb = floor.geometry.boundingBox!
  const { x: sx, y: sy, z: sz } = floor.scale
  return {
    center: [
      floor.position.x + ((bb.max.x + bb.min.x) / 2) * sx,
      floor.position.z + ((bb.max.z + bb.min.z) / 2) * sz,
    ],
    surfaceY: floor.position.y + (bb.max.y ?? 0) * sy,
    width: (bb.max.x - bb.min.x) * sx,
    depth: (bb.max.z - bb.min.z) * sz,
  }
}

/** A floor this full of its bounds is a rectangle: the plane draws it exactly. */
const RECTANGLE_FILL = 0.98

/**
 * AR-170 — a floor whose outline is not its bounding rectangle (Vienna's L since vienna16), as its
 * own shape in the plane's frame: the rectangle's corner outside the building showed through the
 * second room's windows once they looked onto a street. Planar uv as the plane's, so the boards and
 * every map stay where the rectangle put them. Null for a rectangular floor (Paris, Madrid): it
 * keeps the plane, exactly as before. Keyed on the model's floor, never on the space.
 */
export const floorOutline = (floor: Mesh, plane: FloorPlane): BufferGeometry | null => {
  const position = floor.geometry.attributes.position
  const index = floor.geometry.index
  const { x: sx, z: sz } = floor.scale
  const [cx, cz] = plane.center
  const count = index ? index.count : position.count
  const at = (i: number) => (index ? index.getX(i) : i)
  // The plane's local frame: x along x, y along −z (the mesh is turned −90° about x).
  const local = (v: number) => [
    floor.position.x + position.getX(v) * sx - cx,
    -(floor.position.z + position.getZ(v) * sz - cz),
  ]
  const vertices: number[] = []
  let area = 0
  for (let i = 0; i + 2 < count; i += 3) {
    const a = local(at(i))
    let [b, c] = [local(at(i + 1)), local(at(i + 2))]
    const signed = ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2
    // Facing the plane's normal (up in the room).
    if (signed < 0) [b, c] = [c, b]
    area += Math.abs(signed)
    vertices.push(a[0], a[1], 0, b[0], b[1], 0, c[0], c[1], 0)
  }
  if (area >= RECTANGLE_FILL * plane.width * plane.depth) return null
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
  const uv = new Float32Array((vertices.length / 3) * 2)
  for (let v = 0; v < vertices.length / 3; v++) {
    uv[2 * v] = vertices[3 * v] / plane.width + 0.5
    uv[2 * v + 1] = vertices[3 * v + 1] / plane.depth + 0.5
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  // AO maps read uv2, as on the plane.
  geometry.setAttribute('uv2', new BufferAttribute(uv.slice(), 2))
  geometry.computeVertexNormals()
  return geometry
}
