import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Vector3, type Mesh, type Object3D } from 'three'

import { getSpaceConfig } from '@/components/scene/constants'
import { spaceGltfUrl } from '@/components/scene/spaceAsset'
import { groupNodesByRoom, worldMatrixOf } from '@/components/scene/spaces/objects/nodeIndices'
import type { RootState } from '@/redux/store'

/**
 * Gallery benches — real bench models the artist places in the room (AR-167).
 *
 * Unlike display panels, benches are not nodes in the space's GLB: each room gets
 * BENCHES_PER_ROOM of them, and the artist picks the model. Indices run in blocks
 * of ten per room, like the panels — room 0 uses 0–3, room 1 uses 10–13.
 *
 * Every model is at its exact real size; the GLBs are converted from the
 * manufacturer's centimeters and never rescaled.
 */
export const BENCH_MODELS = [
  { value: 'odes', label: 'Odes' },
  { value: 'black', label: 'Black' },
] as const

export type BenchModel = (typeof BENCH_MODELS)[number]['value']

export type BenchSettings = {
  enabled?: boolean
  model?: BenchModel
  /** Offset from the bench's starting spot, in metres. */
  x?: number
  z?: number
  /** Rotation about the bench's own center, in degrees. */
  rotationY?: number
}

export const BENCHES_PER_ROOM = 4

/**
 * Whether artists see the Furniture panel in the 3D editor. Off while benches are paused (owner,
 * 2026-10-28: "we will refine later"); the code ships with the print presentations, hidden.
 * Design Connected has OK'd their models for the online gallery in writing (2026-10-28).
 */
export const FURNITURE_PANEL_ENABLED = false

/**
 * Where a room's benches start: a 2 × 2 group around its centre, in metres. A row of four
 * would run over 9 m and into the walls of a smaller room.
 */
const START_SPACING_X = 2.5
const START_SPACING_Z = 2

export const benchIndex = (room: number, slot: number) => room * 10 + slot

/** Off until switched on: an exhibition with no settings has no benches. */
export const isBenchEnabled = (settings?: BenchSettings): boolean => settings?.enabled ?? false

/** The bench's model, or the first one when it has none (or names a model since removed). */
export const benchModelOf = (settings?: BenchSettings): BenchModel =>
  BENCH_MODELS.find((m) => m.value === settings?.model)?.value ?? BENCH_MODELS[0].value

export const benchModelUrl = (model: BenchModel) => `/assets/furniture/${model}/${model}.glb`

export const benchStart = (centre: Vector3, slot: number): Vector3 =>
  centre
    .clone()
    .add(
      new Vector3(
        ((slot % 2) - 0.5) * START_SPACING_X,
        0,
        (Math.floor(slot / 2) - 0.5) * START_SPACING_Z,
      ),
    )

export type BenchRoom = { room: number; centre: Vector3 }

/**
 * The space's rooms and the floor point at the middle of each.
 *
 * A room's centre is the mean of its placeholders (its hangable walls), which
 * surround it — no extra authoring in Blender. A space without room empties is
 * one room.
 */
export const useBenchRooms = (): { rooms: BenchRoom[]; floorY: number } => {
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) || 'paris'
  const { nodes } = useGLTF(spaceGltfUrl(getSpaceConfig(spaceId).gltfPath)) as unknown as {
    nodes: Record<string, unknown>
  }

  return useMemo(() => {
    const floor = nodes.floor0 as Mesh | undefined
    let floorY = 0
    if (floor) {
      floor.geometry.computeBoundingBox()
      floorY = floor.position.y + (floor.geometry.boundingBox?.max.y ?? 0) * floor.scale.y
    }

    const rooms = groupNodesByRoom(nodes, 'placeholder').map((group, room) => {
      const centre = new Vector3()
      let n = 0
      for (const i of group.indices) {
        const node = nodes[`placeholder${i}`] as Object3D | undefined
        if (!node) continue
        centre.add(new Vector3().setFromMatrixPosition(worldMatrixOf(node)))
        n += 1
      }
      if (n > 0) centre.divideScalar(n)
      return { room, centre: centre.setY(floorY) }
    })

    return { rooms, floorY }
  }, [nodes])
}
