/**
 * Which side of an Object's box a click stands the visitor in front of (docs/objects, owner
 * 2026-11-25: "if I click on any side, position the camera near that side; on the top or bottom,
 * just approach the closest horizontal box side"). Pure: the room's camera does the moving.
 *
 * Coordinates are the Object's own, in metres: x and z across its footprint, centred (its turn
 * taken out), y up from its base. `half` is the box's half width (x) and half depth (z), `height`
 * its height, all at the Object's size on the floor.
 */

export type BoxSide = '+x' | '-x' | '+z' | '-z'

type Point = { x: number; y: number; z: number }
type Half = { w: number; d: number }

const SIDES: BoxSide[] = ['+x', '-x', '+z', '-z']

/** How far a point is inside the box from a side's plane (0 on the side). */
const fromSide = (side: BoxSide, p: { x: number; z: number }, half: Half) =>
  side === '+x'
    ? half.w - p.x
    : side === '-x'
      ? half.w + p.x
      : side === '+z'
        ? half.d - p.z
        : half.d + p.z

/** The side's outward direction in the Object's own coordinates. */
export const sideNormal = (side: BoxSide) => ({
  x: side === '+x' ? 1 : side === '-x' ? -1 : 0,
  z: side === '+z' ? 1 : side === '-z' ? -1 : 0,
})

/**
 * The clicked side: the box face nearest the click. A click on the top or the bottom takes the
 * nearest side among those facing the camera, so the way there never crosses the Object.
 */
export function clickedSide(hit: Point, half: Half, height: number, camera: Point): BoxSide {
  const nearestSide = (sides: BoxSide[]) =>
    sides.reduce((best, s) => (fromSide(s, hit, half) < fromSide(best, hit, half) ? s : best))
  const side = nearestSide(SIDES)
  const toTopOrBottom = Math.min(height - hit.y, hit.y)
  if (fromSide(side, hit, half) <= toTopOrBottom) return side
  const facing = SIDES.filter((s) => {
    const n = sideNormal(s)
    return n.x * camera.x + n.z * camera.z > 0
  })
  return nearestSide(facing.length ? facing : SIDES)
}

/** A side's middle and its length along the floor, in the Object's own coordinates. */
export function sideFace(side: BoxSide, half: Half, height: number) {
  const n = sideNormal(side)
  return {
    center: { x: n.x * half.w, y: height / 2, z: n.z * half.d },
    normal: n,
    width: n.x !== 0 ? half.d * 2 : half.w * 2,
  }
}

/** World ↔ the Object's own coordinates: its spot on the floor and its turn about y (radians). */
export const toObject = (p: Point, origin: Point, turn: number): Point => {
  const dx = p.x - origin.x
  const dz = p.z - origin.z
  const c = Math.cos(turn)
  const s = Math.sin(turn)
  return { x: dx * c - dz * s, y: p.y - origin.y, z: dx * s + dz * c }
}

export const toWorld = (p: Point, origin: Point, turn: number): Point => {
  const c = Math.cos(turn)
  const s = Math.sin(turn)
  return { x: origin.x + p.x * c + p.z * s, y: origin.y + p.y, z: origin.z - p.x * s + p.z * c }
}
