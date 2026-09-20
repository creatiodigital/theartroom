import { useEffect, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { Matrix4, Mesh, Box3 } from 'three'

import { worldMatrixOf } from '@/components/scene/spaces/objects/nodeIndices'
import {
  panelIndexOfFace,
  panelMatrix,
  panelPivot,
  type PanelSettings,
} from '@/components/scene/spaces/objects/Panel/panelSettings'
import type { RootState } from '@/redux/store'
import { calculateAverageNormal, calculateDimensionsAndBasis } from '@/components/wallview/utils'
import type { TDimensions } from '@/types/geometry'

export type TBoundingData = TDimensions & {
  boundingBox: Box3
  normal: { x: number; y: number; z: number }
  /**
   * The panel transform that maps this face into the room, or identity for an
   * ordinary wall.
   *
   * Everything above is in the face's OWN space — where Blender left it — and
   * that is what gets stored per artwork. This matrix is what turns it into
   * world space, and it is deliberately handed over UNAPPLIED. See the note on
   * `faceBoundingData`.
   */
  panelTransform: Matrix4
}

/**
 * A wall face's geometry, in the face's own space, plus the transform that puts
 * it in the room.
 *
 * 🔒 The split is the whole point, and it is load-bearing.
 *
 * `convert2DTo3D` builds the stored `posX3d/Y3d/Z3d` out of this, and
 * `ArtObjects` applies the panel matrix again when it draws. If this returned
 * world-space geometry, the matrix would be applied TWICE — once on the way
 * into the database and once on the way out — and an artwork on a moved panel
 * would be flung across the room on a radius equal to its distance from the
 * pivot. That is exactly what happened on 2026-09-20: a panel rotated -90° put
 * its back-face works 3.3 m out, next to the windows.
 *
 * It stayed invisible for as long as it did because the matrix is IDENTITY
 * until a panel is actually moved, and applying identity twice costs nothing.
 *
 * So: what is stored must not depend on where the panel currently stands. A
 * consumer that genuinely needs world space — the wall-view camera is the only
 * one — applies `panelTransform` itself, at the point of use.
 *
 * Pure, so `e2e/panel-transform.spec.ts` can hold it to that contract.
 */
export const faceBoundingData = (
  faceNode: Mesh,
  panelNode: Mesh | null,
  panelSettings: PanelSettings | undefined,
): TBoundingData | null => {
  if (!faceNode?.geometry) return null
  if (!faceNode.geometry.boundingBox) faceNode.geometry.computeBoundingBox()
  if (!faceNode.geometry.boundingBox) return null

  // `worldMatrixOf` rather than `matrixWorld` because a space whose placeholders
  // hang off a room Empty has already had that offset baked into the node.
  const boundingBox = (faceNode.geometry.boundingBox as Box3).clone()
  boundingBox.applyMatrix4(worldMatrixOf(faceNode))
  const normal = calculateAverageNormal(faceNode)

  const panelTransform = panelNode
    ? panelMatrix(panelSettings, panelPivot(panelNode))
    : new Matrix4()

  const dimensions = calculateDimensionsAndBasis(boundingBox, normal)

  if (
    !Number.isFinite(dimensions.width) ||
    !Number.isFinite(dimensions.height) ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  ) {
    return null
  }

  return { ...dimensions, boundingBox, normal, panelTransform }
}

export const useBoundingData = (
  nodes: Record<string, Mesh>,
  currentWallId: string | null,
): TBoundingData | null => {
  const [boundingData, setBoundingData] = useState<TBoundingData | null>(null)

  // A display panel's faces are ordinary placeholders, but the panel itself
  // moves. The matrix comes back on the result rather than baked into it — see
  // the note on `faceBoundingData`.
  const panelIndex = panelIndexOfFace(currentWallId)
  const panelSettings = useSelector((state: RootState) =>
    panelIndex === null ? undefined : state.exhibition.panelSettings?.[String(panelIndex)],
  )
  const retryCount = useRef(0)
  const maxRetries = 5
  const prevNodesRef = useRef<Record<string, Mesh> | null>(null)

  useEffect(() => {
    // Clear stale data immediately when wall or nodes change
    // This prevents old dimensions from showing during transitions
    if (nodes !== prevNodesRef.current) {
      setBoundingData(null)
      prevNodesRef.current = nodes
    }

    if (!currentWallId || !nodes || Object.keys(nodes).length === 0) {
      setBoundingData(null)
      return
    }

    // Reset retry count and clear data when wall changes
    retryCount.current = 0
    setBoundingData(null)

    const computeBoundingData = () => {
      // Match by name instead of uuid for stable identification across page loads
      const currentWall = Object.values(nodes).find((obj) => obj.name === currentWallId)

      // Geometry or its normal attribute may not be ready on the first tick.
      if (!currentWall?.geometry || !currentWall.geometry.attributes?.normal?.array) {
        if (retryCount.current < maxRetries) {
          retryCount.current++
          setTimeout(computeBoundingData, 100)
        }
        return
      }

      const panelNode = panelIndex === null ? null : (nodes[`panel${panelIndex}`] ?? null)
      const data = faceBoundingData(currentWall, panelNode, panelSettings)

      if (data) {
        setBoundingData(data)
      } else if (retryCount.current < maxRetries) {
        retryCount.current++
        setTimeout(computeBoundingData, 100)
      } else {
        console.warn('useBoundingData: could not compute face geometry', { currentWallId })
      }
    }

    computeBoundingData()
  }, [currentWallId, nodes, panelIndex, panelSettings])

  return boundingData
}
