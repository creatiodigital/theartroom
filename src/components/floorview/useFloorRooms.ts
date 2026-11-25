'use client'

import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3, type Mesh } from 'three'

import { getSpaceConfig } from '@/components/scene/constants'
import { spaceGltfUrl } from '@/components/scene/spaceAsset'
import { groupNodesByRoom, worldMatrixOf } from '@/components/scene/spaces/objects/nodeIndices'
import type { RootState } from '@/redux/store'

/** One wall in plan: a segment, world meters. */
export type PlanWall = { name: string; x1: number; z1: number; x2: number; z2: number }

/** A room as the Floor view draws it (world meters, the floor's height in y). */
export type FloorRoom = {
  room: number
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  centerX: number
  centerZ: number
  walls: PlanWall[]
}

/**
 * The space's rooms seen from above (docs/objects O6): each room's walls, from its hangable wall
 * placeholders (the same ones the wall view edits), and the box around them. A space without room
 * Empties is one room (Paris). Read from the space model the scene has already loaded.
 */
export function useFloorRooms(): { rooms: FloorRoom[]; floorY: number } {
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
      const walls: PlanWall[] = []
      for (const i of group.indices) {
        const name = `placeholder${i}`
        const node = nodes[name] as Mesh | undefined
        if (!node?.geometry) continue
        node.geometry.computeBoundingBox()
        const local = node.geometry.boundingBox
        if (!local) continue
        const world = new Box3()
        const matrix = worldMatrixOf(node)
        for (const x of [local.min.x, local.max.x])
          for (const y of [local.min.y, local.max.y])
            for (const z of [local.min.z, local.max.z])
              world.expandByPoint(new Vector3(x, y, z).applyMatrix4(matrix))
        const dx = world.max.x - world.min.x
        const dz = world.max.z - world.min.z
        const midX = (world.min.x + world.max.x) / 2
        const midZ = (world.min.z + world.max.z) / 2
        walls.push(
          dx >= dz
            ? { name, x1: world.min.x, z1: midZ, x2: world.max.x, z2: midZ }
            : { name, x1: midX, z1: world.min.z, x2: midX, z2: world.max.z },
        )
      }
      const xs = walls.flatMap((w) => [w.x1, w.x2])
      const zs = walls.flatMap((w) => [w.z1, w.z2])
      const minX = xs.length ? Math.min(...xs) : -5
      const maxX = xs.length ? Math.max(...xs) : 5
      const minZ = zs.length ? Math.min(...zs) : -5
      const maxZ = zs.length ? Math.max(...zs) : 5
      return {
        room,
        minX,
        maxX,
        minZ,
        maxZ,
        centerX: (minX + maxX) / 2,
        centerZ: (minZ + maxZ) / 2,
        walls,
      }
    })

    return { rooms, floorY }
  }, [nodes])
}
