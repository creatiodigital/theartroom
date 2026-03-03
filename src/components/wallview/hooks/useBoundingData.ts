import { useEffect, useState, useRef } from 'react'
import { Mesh, Box3 } from 'three'

import { calculateAverageNormal, calculateDimensionsAndBasis } from '@/components/wallview/utils'
import type { TDimensions } from '@/types/geometry'

type TBoundingData = TDimensions & {
  boundingBox: Box3
  normal: { x: number; y: number; z: number }
}

export const useBoundingData = (
  nodes: Record<string, Mesh>,
  currentWallId: string | null,
): TBoundingData | null => {
  const [boundingData, setBoundingData] = useState<TBoundingData | null>(null)
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

      if (!currentWall?.geometry) {
        // Retry if geometry not ready
        if (retryCount.current < maxRetries) {
          retryCount.current++
          setTimeout(computeBoundingData, 100)
        }
        return
      }

      // Ensure bounding box is computed
      if (!currentWall.geometry.boundingBox) {
        currentWall.geometry.computeBoundingBox()
      }

      // Ensure we have attributes - retry if not
      if (!currentWall.geometry.attributes?.normal?.array) {
        if (retryCount.current < maxRetries) {
          retryCount.current++
          setTimeout(computeBoundingData, 100)
          return
        }
      }

      if (currentWall.geometry.boundingBox) {
        // Clone the geometry bounding box and translate it to world space
        // (geometry is in local space; the mesh's position provides the world offset)
        const localBB = currentWall.geometry.boundingBox as Box3
        const boundingBox = localBB.clone()
        currentWall.updateWorldMatrix(true, false)
        boundingBox.applyMatrix4(currentWall.matrixWorld)
        const normal = calculateAverageNormal(currentWall)
        const dimensions = calculateDimensionsAndBasis(boundingBox, normal)

        // Validate dimensions before setting
        if (
          Number.isFinite(dimensions.width) &&
          Number.isFinite(dimensions.height) &&
          dimensions.width > 0 &&
          dimensions.height > 0
        ) {
          setBoundingData({ ...dimensions, boundingBox, normal })
        } else if (retryCount.current < maxRetries) {
          // Retry if dimensions are invalid
          retryCount.current++
          setTimeout(computeBoundingData, 100)
        } else {
          console.warn('useBoundingData: Invalid dimensions after retries', {
            dimensions,
            boundingBox,
            normal,
          })
        }
      }
    }

    computeBoundingData()
  }, [currentWallId, nodes])

  return boundingData
}
