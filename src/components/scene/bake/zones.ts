import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'

/**
 * ⚠️ AR-161 — where in the room a point is, for per-zone lighting design: a corridor (a passage
 * narrower than CORRIDOR_WIDTH) keeps standard fixtures; the exhibition rooms get the rated-up
 * general light.
 */
// metres: circulation (Paris's corridor 2.3 m, its end vestibule 4.7 m) vs exhibition rooms (16 m).
export const CORRIDOR_WIDTH = 6

/** The walls as a two-sided raycast target (their own material may be single-sided). */
export const raycastableWalls = (wall: Mesh): Mesh => {
  wall.updateMatrixWorld(true)
  const target = new Mesh(wall.geometry, new MeshBasicMaterial({ side: DoubleSide }))
  target.matrixAutoUpdate = false
  target.matrix.copy(wall.matrixWorld)
  target.matrixWorld.copy(wall.matrixWorld)
  return target
}

const ray = new Raycaster()

/** Distance to the nearest wall from `from` along `direction` (Infinity if none). */
export const wallDistance = (walls: Mesh, from: Vector3, direction: Vector3): number => {
  ray.set(from, direction.clone().normalize())
  ray.far = 100
  const hit = ray.intersectObject(walls, false)[0]
  return hit ? hit.distance : Infinity
}

/** True when the free space across x or z at `point` (at eye height) is narrower than a room. */
export const inCorridor = (walls: Mesh, point: Vector3): boolean => {
  const p = point.clone().setY(1.5)
  const span = (axis: Vector3) =>
    wallDistance(walls, p, axis) + wallDistance(walls, p, axis.clone().negate())
  return Math.min(span(new Vector3(1, 0, 0)), span(new Vector3(0, 0, 1))) < CORRIDOR_WIDTH
}
