'use client'

/**
 * Which room the visitor is standing in — so the other room's lights can be
 * switched off.
 *
 * three's forward renderer evaluates EVERY enabled light for every fragment. It
 * never culls lights by distance or frustum, so a lamp in a room you cannot see
 * costs exactly as much as one overhead. Vienna measured 22 spotlights at 6.8 ms
 * per frame — 39% of the whole frame — with half of them lighting a room that
 * was never on screen.
 *
 * This is safe precisely because a multi-room space is authored so the rooms are
 * never co-visible (the connecting corridor bends). Switching off the far room's
 * lights is therefore invisible, not a quality trade.
 *
 * Re-tested 2026-09-15, because "are these lights really costing us anything?" is
 * the obvious thing to doubt: running every round AND recessed lamp in both rooms,
 * with dpr pinned at 1.5 so the adaptive ladder could not absorb the difference as
 * a resolution drop, took Vienna from a locked 60 fps to 45. So the answer is yes,
 * and culling stays. Pin dpr before repeating this — with the ladder live, fps
 * holds at 60 and the cost shows up only as a lower dpr, which reads as "free".
 *
 * The narrow exception is `alwaysLitLamps` (see spaceConfig): a handful of lamps
 * lighting the corridor BETWEEN rooms, which the visitor walks directly beneath.
 * Four extra spotlights is a cost worth paying; seventeen is not.
 *
 * A space with no room grouping — Paris, Madrid — gets a predicate that is always
 * true, so nothing changes for them.
 */

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Vector3 } from 'three'

import { getSpaceFeatures } from '@/config/spaceConfig'
import type { RootState } from '@/redux/store'

import { groupNodesByRoom } from './nodeIndices'

/** Metres the next room must be closer by before we switch, so standing near a
 *  threshold cannot flap the lights on and off frame to frame. */
const HYSTERESIS = 2

/** Stable identity, so an unconfigured space does not invalidate memos each render. */
const NO_ALWAYS_LIT: readonly number[] = []

type PositionedNode = { position?: { x: number; y: number; z: number } }
type RoomGroup = { room: string | null; indices: number[] }

/**
 * Mean position of a room's lamps, ignoring any that are always lit.
 *
 * Corridor lamps are excluded because they sit BETWEEN the rooms: counting them
 * drags the centre out of the room and up the corridor, which in turn moves the
 * point where the two rooms trade places. The centre should describe where the
 * room is, not how far its lighting reaches.
 *
 * A group with nothing left returns the origin rather than NaN — dividing by
 * zero here would poison every distance comparison that follows.
 */
export const roomCentre = (
  indices: readonly number[],
  nodes: Record<string, unknown>,
  prefix: string,
  alwaysLit: readonly number[],
): Vector3 => {
  const exempt = new Set(alwaysLit)
  const c = new Vector3()
  let n = 0
  for (const i of indices) {
    if (exempt.has(i)) continue
    const p = (nodes[`${prefix}${i}`] as PositionedNode | undefined)?.position
    if (!p) continue
    c.add(new Vector3(p.x, p.y, p.z))
    n += 1
  }
  return n > 0 ? c.divideScalar(n) : c
}

/**
 * Which lamp indices should be lit: the active room's, plus the always-lit ones
 * wherever the visitor happens to be.
 *
 * A space with a single group has no far room to switch off, so everything stays
 * lit — Paris and Madrid never change behaviour.
 */
export const litLampPredicate = (
  groups: readonly RoomGroup[],
  active: number,
  alwaysLit: readonly number[],
): ((index: number) => boolean) => {
  if (groups.length <= 1) return () => true
  const activeIndices = new Set(groups[active]?.indices ?? [])
  const exempt = new Set(alwaysLit)
  return (index: number) => activeIndices.has(index) || exempt.has(index)
}

export const useActiveRoom = (
  nodes: Record<string, unknown>,
  prefix: string,
): ((index: number) => boolean) => {
  const groups = useMemo(() => groupNodesByRoom(nodes, prefix), [nodes, prefix])

  // Read the space the same way TrackLamp does, so the call sites stay
  // `useActiveRoom(nodes, prefix)` and no space has to thread config through the
  // lamp components.
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) || 'paris'
  const alwaysLit = useMemo(
    () => getSpaceFeatures(spaceId).alwaysLitLamps?.[prefix] ?? NO_ALWAYS_LIT,
    [spaceId, prefix],
  )

  // Room centre = mean of its own nodes. No extra authoring needed, and it moves
  // with the model rather than drifting from a hardcoded coordinate.
  const centres = useMemo(
    () => groups.map((g) => roomCentre(g.indices, nodes, prefix, alwaysLit)),
    [groups, nodes, prefix, alwaysLit],
  )

  // Culling is unconditional. Two earlier versions exempted the editor — first
  // the whole edit view, then just "while the lighting panel is open" — so that
  // an artist adjusting a lamp in the room they are NOT standing in would still
  // see it respond. Both were wrong in the same way: they made the editor the
  // one place where every light in the building is live (Vienna: 34 or 44
  // spotlights instead of 17 or 22), which is exactly where the space is
  // authored, judged, and profiled. An artist who wants to see a lamp respond
  // can walk into its room — that is one gesture, and it is the same thing a
  // visitor will see.
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const single = groups.length <= 1

  useFrame(({ camera }) => {
    if (single) return

    let nearest = activeRef.current
    let nearestDist = Infinity
    centres.forEach((c, i) => {
      const d = camera.position.distanceTo(c)
      if (d < nearestDist) {
        nearestDist = d
        nearest = i
      }
    })

    if (nearest === activeRef.current) return
    // Only switch once the new room is decisively closer.
    const currentDist = camera.position.distanceTo(centres[activeRef.current])
    if (currentDist - nearestDist < HYSTERESIS) return

    activeRef.current = nearest
    setActive(nearest)
  })

  return useMemo(
    () => litLampPredicate(groups, active, alwaysLit),
    [groups, active, alwaysLit],
  )
}
