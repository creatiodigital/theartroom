import { Matrix3, Raycaster, Vector3, type Intersection, type Mesh, type Ray } from 'three'

import { FLOOR_Y, MIN_WALK, WALL_APPROACH_DISTANCE, WALL_CLEARANCE, WALL_TAP } from './navigation'

/**
 * The room's solid surfaces (walls, windows, glass), asked of in one place: where a tap walks
 * to, how close to a wall a walk may end, and whether a work under a finger is behind a wall.
 * `MainCamera` gives the source; the artworks' taps read it too (`tapTracker`).
 */
let source: () => Mesh[] = () => []

export const setRoomMeshes = (meshes: () => Mesh[]) => {
  source = meshes
}

export const roomMeshes = () => source()

const raycaster = new Raycaster()

/** The first of the room's surfaces along a ray, within `far`. */
export const firstRoomHit = (
  origin: Vector3,
  direction: Vector3,
  far: number,
  meshes: Mesh[] = roomMeshes(),
): Intersection | null => {
  if (meshes.length === 0 || far <= 0) return null
  raycaster.set(origin, direction)
  raycaster.near = 0
  raycaster.far = far
  return raycaster.intersectObjects(meshes, true)[0] ?? null
}

/**
 * Whether a wall stands between a ray's origin and the point `distance` along it. The scene's
 * pointer events reach every object the ray passes, walls or no walls, so a work in the next room
 * would otherwise answer a tap on the wall in front of it.
 */
export const roomBlocks = (ray: Ray, distance: number) =>
  !!firstRoomHit(ray.origin, ray.direction, distance - 0.01)

const normalMatrix = new Matrix3()

/** A hit's surface normal, in the world, along the floor and facing back along the ray. */
export const surfaceNormal = (hit: Intersection, along: Vector3): Vector3 | null => {
  if (!hit.face) return null
  normalMatrix.getNormalMatrix(hit.object.matrixWorld)
  const n = hit.face.normal.clone().applyMatrix3(normalMatrix)
  n.y = 0
  if (n.lengthSq() < 1e-6) return null
  n.normalize()
  if (n.dot(along) > 0) n.negate()
  return n
}

const COMPASS = Array.from({ length: 8 }, (_, k) => {
  const a = (k * Math.PI) / 4
  return new Vector3(Math.cos(a), 0, Math.sin(a))
})

/**
 * A point at eye height moved away from every wall nearer than the clearance, looking around
 * it in eight directions (twice, for a corner, where moving off one wall can bring another near).
 * `axis`, when given, limits the move to that line (Artwork View slides only along its wall).
 */
const settle = (point: Vector3, axis?: Vector3) => {
  for (let pass = 0; pass < 2; pass += 1) {
    const push = new Vector3()
    for (const direction of axis ? [axis, axis.clone().negate()] : COMPASS) {
      const hit = firstRoomHit(point, direction, WALL_CLEARANCE)
      if (hit) push.addScaledVector(direction, -(WALL_CLEARANCE - hit.distance))
    }
    if (push.lengthSq() < 1e-8) return
    point.add(push)
  }
}

/** How far along the floor from `eye` toward `to` a walk may go before it comes too near a wall. */
const reach = (eye: Vector3, to: Vector3) => {
  const direction = new Vector3(to.x - eye.x, 0, to.z - eye.z)
  const length = direction.length()
  if (length < 1e-6) return { direction, length: 0 }
  direction.divideScalar(length)
  const hit = firstRoomHit(eye, direction, length + WALL_CLEARANCE)
  return { direction, length: hit ? Math.min(length, hit.distance - WALL_CLEARANCE) : length }
}

/**
 * Where a walk from `eye` toward (x, z) can safely end: no nearer a wall than the clearance, and
 * short of any wall on the straight way there. Null when it would not get anywhere.
 */
export const safeDestination = (eye: Vector3, x: number, z: number) => {
  const first = reach(eye, new Vector3(x, eye.y, z))
  if (first.length <= MIN_WALK) return null
  const end = eye.clone().addScaledVector(first.direction, first.length)
  settle(end)
  // The settle may have stepped it across the way there: check the way again.
  const second = reach(eye, end)
  if (second.length <= MIN_WALK) return null
  return eye.clone().addScaledVector(second.direction, second.length)
}

/**
 * Where a tap along `ray` (cast from the eye through the finger) asks to walk: the floor where it
 * lands, or a step in front of the wall it meets first. Null for anything else (the ceiling, the
 * sky through a skylight), or when the walk would go nowhere.
 */
export const tapDestination = (ray: Ray, eye: Vector3) => {
  const wall = firstRoomHit(ray.origin, ray.direction, 500)
  const toFloor =
    ray.direction.y < -1e-4 ? (FLOOR_Y - ray.origin.y) / ray.direction.y : Number.POSITIVE_INFINITY
  if (toFloor < (wall?.distance ?? Number.POSITIVE_INFINITY)) {
    const x = ray.origin.x + ray.direction.x * toFloor
    const z = ray.origin.z + ray.direction.z * toFloor
    return safeDestination(eye, x, z)
  }
  if (!wall || WALL_TAP === 'ignore') return null
  const n = surfaceNormal(wall, ray.direction)
  if (!n) return null
  return safeDestination(
    eye,
    wall.point.x + n.x * WALL_APPROACH_DISTANCE,
    wall.point.z + n.z * WALL_APPROACH_DISTANCE,
  )
}

/** Artwork View's spot, slid along its wall (`along`) until it is clear of the walls beside it. */
export const settleBeside = (point: Vector3, along: Vector3) => {
  settle(point, along)
  return point
}
