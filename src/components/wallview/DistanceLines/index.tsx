'use client'

import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

import styles from './DistanceLines.module.scss'

type DistanceLine = {
  direction: 'horizontal' | 'vertical'
  x1: number
  y1: number
  x2: number
  y2: number
  distance: number
  labelX: number
  labelY: number
}

export const DistanceLines = () => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const isDragging = useSelector((state: RootState) => state.wallView.isDragging)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const allExhibitionArtworkIds = useSelector(
    (state: RootState) => state.exhibition.allExhibitionArtworkIds,
  )

  // Only show during drag operations (not resize)
  const shouldShow = currentArtworkId && isDragging

  if (!shouldShow || !currentArtworkId) return null

  const currentArtwork = exhibitionArtworksById[currentArtworkId]
  if (!currentArtwork) return null

  // Get all other artworks on the same wall
  const otherArtworks = allExhibitionArtworkIds
    .map((id) => exhibitionArtworksById[id])
    .filter((a) => a && a.wallId === currentWallId && a.artworkId !== currentArtworkId)

  const x = currentArtwork.posX2d
  const y = currentArtwork.posY2d
  const w = currentArtwork.width2d
  const h = currentArtwork.height2d

  const distanceLines: DistanceLine[] = []

  // Structure to hold nearest artwork info
  type NearestInfo = { ox: number; oy: number; ow: number; oh: number; distance: number }
  let nearestLeft: NearestInfo | null = null
  let nearestRight: NearestInfo | null = null
  let nearestTop: NearestInfo | null = null
  let nearestBottom: NearestInfo | null = null

  otherArtworks.forEach((other) => {
    if (!other) return
    const ox = other.posX2d
    const oy = other.posY2d
    const ow = other.width2d
    const oh = other.height2d

    // Check for vertical overlap (Y-axis intersection)
    const verticalOverlapStart = Math.max(y, oy)
    const verticalOverlapEnd = Math.min(y + h, oy + oh)
    const hasVerticalOverlap = verticalOverlapEnd > verticalOverlapStart

    // Check for horizontal overlap (X-axis intersection)
    const horizontalOverlapStart = Math.max(x, ox)
    const horizontalOverlapEnd = Math.min(x + w, ox + ow)
    const hasHorizontalOverlap = horizontalOverlapEnd > horizontalOverlapStart

    // Left: other artwork is to the left and has vertical overlap
    if (hasVerticalOverlap && ox + ow <= x) {
      const distance = x - (ox + ow)
      if (!nearestLeft || distance < nearestLeft.distance) {
        nearestLeft = { ox, oy, ow, oh, distance }
      }
    }

    // Right: other artwork is to the right and has vertical overlap
    if (hasVerticalOverlap && ox >= x + w) {
      const distance = ox - (x + w)
      if (!nearestRight || distance < nearestRight.distance) {
        nearestRight = { ox, oy, ow, oh, distance }
      }
    }

    // Top: other artwork is above and has horizontal overlap
    if (hasHorizontalOverlap && oy + oh <= y) {
      const distance = y - (oy + oh)
      if (!nearestTop || distance < nearestTop.distance) {
        nearestTop = { ox, oy, ow, oh, distance }
      }
    }

    // Bottom: other artwork is below and has horizontal overlap
    if (hasHorizontalOverlap && oy >= y + h) {
      const distance = oy - (y + h)
      if (!nearestBottom || distance < nearestBottom.distance) {
        nearestBottom = { ox, oy, ow, oh, distance }
      }
    }
  })

  // Create distance lines for each direction
  if (nearestLeft) {
    const { ox, oy, ow, oh, distance } = nearestLeft
    const overlapStart = Math.max(y, oy)
    const overlapEnd = Math.min(y + h, oy + oh)
    const lineY = (overlapStart + overlapEnd) / 2

    distanceLines.push({
      direction: 'horizontal',
      x1: ox + ow,
      y1: lineY,
      x2: x,
      y2: lineY,
      distance,
      labelX: (ox + ow + x) / 2,
      labelY: lineY,
    })
  }

  if (nearestRight) {
    const { ox, oy, oh, distance } = nearestRight
    const overlapStart = Math.max(y, oy)
    const overlapEnd = Math.min(y + h, oy + oh)
    const lineY = (overlapStart + overlapEnd) / 2

    distanceLines.push({
      direction: 'horizontal',
      x1: x + w,
      y1: lineY,
      x2: ox,
      y2: lineY,
      distance,
      labelX: (x + w + ox) / 2,
      labelY: lineY,
    })
  }

  if (nearestTop) {
    const { ox, oy, ow, oh, distance } = nearestTop
    const overlapStart = Math.max(x, ox)
    const overlapEnd = Math.min(x + w, ox + ow)
    const lineX = (overlapStart + overlapEnd) / 2

    distanceLines.push({
      direction: 'vertical',
      x1: lineX,
      y1: oy + oh,
      x2: lineX,
      y2: y,
      distance,
      labelX: lineX,
      labelY: (oy + oh + y) / 2,
    })
  }

  if (nearestBottom) {
    const { ox, oy, ow, distance } = nearestBottom
    const overlapStart = Math.max(x, ox)
    const overlapEnd = Math.min(x + w, ox + ow)
    const lineX = (overlapStart + overlapEnd) / 2

    distanceLines.push({
      direction: 'vertical',
      x1: lineX,
      y1: y + h,
      x2: lineX,
      y2: oy,
      distance,
      labelX: lineX,
      labelY: (y + h + oy) / 2,
    })
  }

  if (distanceLines.length === 0) return null

  return (
    <svg className={styles.container}>
      {distanceLines.map((line, index) => {
        const labelText = `${(line.distance / 100).toFixed(2)} m`
        const labelWidth = labelText.length * 6 + 8 // Approximate width
        const labelHeight = 14

        return (
          <g key={index}>
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              className={styles.line}
            />
            {line.direction === 'horizontal' ? (
              <>
                <rect
                  x={line.labelX - labelWidth / 2}
                  y={line.labelY - 8 - labelHeight + 2}
                  width={labelWidth}
                  height={labelHeight}
                  fill="white"
                  rx={2}
                />
                <text
                  x={line.labelX}
                  y={line.labelY - 8}
                  className={styles.label}
                  dominantBaseline="auto"
                  textAnchor="middle"
                >
                  {labelText}
                </text>
              </>
            ) : (
              <g transform={`rotate(-90 ${line.labelX - 12} ${line.labelY})`}>
                <rect
                  x={line.labelX - 12 - labelWidth / 2}
                  y={line.labelY - labelHeight / 2}
                  width={labelWidth}
                  height={labelHeight}
                  fill="white"
                  rx={2}
                />
                <text
                  x={line.labelX - 12}
                  y={line.labelY}
                  className={styles.label}
                  dominantBaseline="middle"
                  textAnchor="middle"
                >
                  {labelText}
                </text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
