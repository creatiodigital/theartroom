/**
 * Where everything on a floor really stands (docs/objects O6, "Snapping, exactly"). Pure: the 3D
 * scene, the plan and the bake all read the same answer.
 *
 * - A pedestal stands at (x, z), turned rotY, raised `lift` cm.
 * - A free Object stands at (x, z), its base `lift` cm above the floor.
 * - An Object on a pedestal: its base's centre is `offset` cm from the top's centre in the
 *   pedestal's frame, `lift` cm above the top; it turns with the pedestal (rotY is relative).
 */
import type { FloorItem, FloorLayout, FloorObject, FloorPedestal } from './floorLayout'
import { insideOutline, pedestalTop } from './pedestals'

const RAD = Math.PI / 180

export type Placed = {
  /** World metres. */
  x: number
  z: number
  /** The base's height above the floor, metres. */
  y: number
  /** World degrees. */
  rotY: number
}

/** A pedestal's top height above the floor, cm. */
export const pedestalTopCm = (p: FloorPedestal) =>
  p.lift + pedestalTop(p.shape, p.w, p.d, p.h).height

/** Rotate a plan offset (cm) by degrees, around the vertical, as three.js does for +y rotation. */
export function rotateOffset(x: number, z: number, deg: number): [number, number] {
  const a = deg * RAD
  return [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)]
}

export function placePedestal(p: FloorPedestal): Placed {
  return { x: p.x, z: p.z, y: p.lift / 100, rotY: p.rotY }
}

export function placeObject(o: FloorObject, pedestals: Map<string, FloorPedestal>): Placed {
  const on = o.pedestalId ? pedestals.get(o.pedestalId) : undefined
  if (!on) return { x: o.x, z: o.z, y: o.lift / 100, rotY: o.rotY }
  const [dx, dz] = rotateOffset(o.offsetX, o.offsetZ, on.rotY)
  return {
    x: on.x + dx / 100,
    z: on.z + dz / 100,
    y: (pedestalTopCm(on) + o.lift) / 100,
    rotY: on.rotY + o.rotY,
  }
}

/** Every item with where it stands. */
export function placeAll(layout: FloorLayout): { item: FloorItem; at: Placed }[] {
  const pedestals = new Map(
    layout.items.filter((i): i is FloorPedestal => i.kind === 'pedestal').map((p) => [p.id, p]),
  )
  return layout.items.map((item) => ({
    item,
    at: item.kind === 'pedestal' ? placePedestal(item) : placeObject(item, pedestals),
  }))
}

/** A world point (m) in a pedestal's own frame (cm from its centre). */
export function toPedestalFrame(p: FloorPedestal, x: number, z: number): [number, number] {
  return rotateOffset((x - p.x) * 100, (z - p.z) * 100, -p.rotY)
}

/** True when a world point (m) is over a pedestal's top. */
export function overPedestalTop(p: FloorPedestal, x: number, z: number): boolean {
  const [lx, lz] = toPedestalFrame(p, x, z)
  return insideOutline(pedestalTop(p.shape, p.w, p.d, p.h).outline, lx, lz)
}

/**
 * Snap to pedestals: the pedestal whose top the point (an Object's footprint centre, world m) is
 * over, in the same room; the highest top wins where tops overlap. Null: it stands on the floor.
 */
export function pedestalUnder(
  layout: FloorLayout,
  room: number,
  x: number,
  z: number,
): FloorPedestal | null {
  let best: FloorPedestal | null = null
  for (const item of layout.items) {
    if (item.kind !== 'pedestal' || item.room !== room) continue
    if (!overPedestalTop(item, x, z)) continue
    if (!best || pedestalTopCm(item) > pedestalTopCm(best)) best = item
  }
  return best
}

/**
 * An Object dropped (or dragged) to world (x, z): attached to the pedestal under it (centred on
 * the first drop, then at the offset it was dragged to), or free on the floor. `snap` false (Alt)
 * never attaches. The rotation stays as seen: a world angle becomes relative to the pedestal.
 */
export function dropObject(
  layout: FloorLayout,
  o: FloorObject,
  x: number,
  z: number,
  { snap = true, centre = false }: { snap?: boolean; centre?: boolean } = {},
): FloorObject {
  const pedestals = new Map(
    layout.items.filter((i): i is FloorPedestal => i.kind === 'pedestal').map((p) => [p.id, p]),
  )
  const worldRot = placeObject(o, pedestals).rotY
  const target = snap ? pedestalUnder(layout, o.room, x, z) : null
  if (!target) {
    return {
      ...o,
      x,
      z,
      rotY: worldRot,
      pedestalId: null,
      offsetX: 0,
      offsetZ: 0,
      lift: o.pedestalId ? 0 : o.lift,
    }
  }
  const [lx, lz] = centre || o.pedestalId !== target.id ? [0, 0] : toPedestalFrame(target, x, z)
  return {
    ...o,
    x,
    z,
    rotY: worldRot - target.rotY,
    pedestalId: target.id,
    offsetX: Math.round(lx * 10) / 10,
    offsetZ: Math.round(lz * 10) / 10,
    lift: o.pedestalId === target.id ? o.lift : 0,
  }
}

/** Detach: it stays exactly where it is, free on the floor (its lift now from the floor). */
export function detachObject(layout: FloorLayout, o: FloorObject): FloorObject {
  if (!o.pedestalId) return o
  const pedestals = new Map(
    layout.items.filter((i): i is FloorPedestal => i.kind === 'pedestal').map((p) => [p.id, p]),
  )
  const at = placeObject(o, pedestals)
  return {
    ...o,
    x: at.x,
    z: at.z,
    rotY: at.rotY,
    lift: Math.round(at.y * 1000) / 10,
    pedestalId: null,
    offsetX: 0,
    offsetZ: 0,
  }
}

/**
 * A pedestal resized: its Objects keep their offset, and any whose base centre would fall off the
 * new top is put back in the middle.
 */
export function keepObjectsOnTop(layout: FloorLayout, p: FloorPedestal): FloorLayout {
  const top = pedestalTop(p.shape, p.w, p.d, p.h).outline
  const fits = (x: number, z: number) => insideOutline(top, x, z)
  return {
    ...layout,
    items: layout.items.map((i) =>
      i.kind === 'object' && i.pedestalId === p.id && !fits(i.offsetX, i.offsetZ)
        ? { ...i, offsetX: 0, offsetZ: 0 }
        : i,
    ),
  }
}
