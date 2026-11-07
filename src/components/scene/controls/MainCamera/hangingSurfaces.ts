import type { Vector3 } from 'three'

/**
 * The works' hanging surfaces: each work's placeholder (always a plane, where it was hung in the 2D
 * wall view), or a panel's face, as it stands in the room. Wall View travels over the one the work
 * framed hangs on, as far as its own ends and no further (AR-178, owner, 2026-11-07: "when I say 'wall' I'm
 * rather talking about the placeholder, which is the real origin of the artworks"): never the room
 * around it, which may be anything (an isolated wall, a floating ceiling). `ArtObjects`, which holds
 * the space's model and where its panels stand, gives the source.
 */
let source: (wallId: string) => Vector3[] | null = () => null

export const setHangingSurfaces = (points: (wallId: string) => Vector3[] | null) => {
  source = points
}

/** A hanging surface's points in the room (world), or null when there is no such surface. */
export const hangingSurface = (wallId: string) => source(wallId)
