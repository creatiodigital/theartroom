import { DoubleSide, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3 } from 'three'

import { BAKE_DEBUG } from '@/components/scene/bake/bakedLook'

/**
 * AR-170 — a work hangs ON its wall (Eduardo 2026-11-02, of a close look along a wall: "all the
 * artworks are not touching the wall, they look 'suspended'").
 *
 * A work is stored on its placeholder's face (`convert2DTo3D`), and its frame, support and shadow
 * are built from that face into the room. The models' placeholders stand off their walls, though:
 * 4 to 68 mm (Paris 68/41/37/59, Madrid 34/23/4–7/31, Vienna's first room as Paris's, its second
 * 23/11/7/43); the panels' faces are flush. So, as the room is shown, each work on a room wall goes
 * back to the wall itself, measured from the model under its own outline, its back
 * `CLEARANCE` off the plaster. Nothing stored moves: the 2D wall view, every saved exhibition and
 * the placeholders stay as they are, and a model whose placeholders lie on the wall needs nothing.
 *
 * A millimetre, not zero: a frame's back faces the wall and never shows, but a work with no depth
 * (an unframed print, a shape, a text, a video) lying exactly in the wall's plane would flicker with
 * it. At the camera's 0.1 m near plane the depth buffer still tells 0.06 mm apart at 10 m.
 *
 * In development and staging (`BAKE_DEBUG`), to compare: `?wallcontact=0` on the placeholder.
 */
const CLEARANCE = 0.001

/**
 * How far from its placeholder a wall is looked for, either way (a placeholder moved off its wall
 * or into it in Blender): past it, the work stays where it was saved.
 */
const REACH = 0.25

export const wallContactFlag = (): boolean =>
  !(
    BAKE_DEBUG &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('wallcontact') === '0'
  )

const ANY_SIDE = new MeshBasicMaterial({ side: DoubleSide })

/** The model's walls (`wall0`, `wall1`…) in world space, to measure against. */
export const wallSurfaces = (nodes: Record<string, Mesh>): Mesh[] =>
  Object.entries(nodes)
    .filter(([name, node]) => /^wall\d+$/.test(name) && node.isMesh)
    .map(([, node]) => {
      node.updateWorldMatrix(true, false)
      const surface = new Mesh(node.geometry, ANY_SIDE)
      surface.matrixAutoUpdate = false
      surface.matrix.copy(node.matrixWorld)
      surface.matrixWorld.copy(node.matrixWorld)
      return surface
    })

const ray = new Raycaster()
const SAMPLES: [number, number][] = [
  [0, 0],
  [-0.5, -0.5],
  [0.5, -0.5],
  [-0.5, 0.5],
  [0.5, 0.5],
]

/**
 * How far the work at `position` (its back's centre, `quaternion` turning +z out of the wall) must
 * go back along its facing to rest on the wall: the nearest wall point under its centre and corners,
 * `CLEARANCE` off. Negative brings it forward (a wall in front of its placeholder); 0 when no wall
 * lies within `REACH`.
 */
export const depthToWall = (
  walls: Mesh[],
  position: Vector3,
  quaternion: Quaternion,
  width: number,
  height: number,
): number => {
  if (walls.length === 0) return 0
  const facing = new Vector3(0, 0, 1).applyQuaternion(quaternion)
  const across = new Vector3(1, 0, 0).applyQuaternion(quaternion)
  const up = new Vector3(0, 1, 0).applyQuaternion(quaternion)
  const back = facing.clone().negate()
  let nearest = Infinity
  for (const [s, t] of SAMPLES) {
    const from = position
      .clone()
      .addScaledVector(across, s * width)
      .addScaledVector(up, t * height)
      .addScaledVector(facing, REACH)
    ray.set(from, back)
    ray.far = 2 * REACH
    const hit = ray.intersectObjects(walls, false)[0]
    if (hit) nearest = Math.min(nearest, hit.distance - REACH)
  }
  return Number.isFinite(nearest) ? nearest - CLEARANCE : 0
}
