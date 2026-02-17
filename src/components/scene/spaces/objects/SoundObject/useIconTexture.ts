import { useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

const CANVAS_SIZE = 512

/**
 * Icon paths in SVG path-data format (from Lucide, viewBox 0 0 24 24).
 * Each icon has path strings to stroke, plus visual content bounds for centering.
 * fill="none", stroke-width="1.5", linecap/linejoin="round".
 */
type IconDef = {
  paths: string[]
  /** Visual content bounds in viewBox coordinates [minX, minY, maxX, maxY] */
  bounds: [number, number, number, number]
}

const ICON_DEFS: Record<string, IconDef> = {
  'volume-2': {
    paths: [
      // polygon → SVG path
      'M11 5 L6 9 L2 9 L2 15 L6 15 L11 19 Z',
      // small sound arc
      'M15.54 8.46a5 5 0 0 1 0 7.07',
      // large sound arc
      'M19.07 4.93a10 10 0 0 1 0 14.14',
    ],
    bounds: [2, 4.93, 19.07, 19],
  },
  headphones: {
    paths: [
      'M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a7 7 0 0 1 14 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3',
    ],
    bounds: [3, 5, 17, 21],
  },
}

/**
 * Draws an icon onto the canvas context using Path2D with SVG path data.
 * Centers the icon based on its visual content bounds, not just the 24×24 viewBox.
 */
function drawIcon(
  ctx: CanvasRenderingContext2D,
  iconName: string,
  size: number,
  offset: number,
) {
  const def = ICON_DEFS[iconName] ?? ICON_DEFS['volume-2']
  const scale = size / 24
  const [minX, minY, maxX, maxY] = def.bounds

  // Shift so the content center aligns with the viewBox center (12, 12)
  const contentCenterX = (minX + maxX) / 2
  const contentCenterY = (minY + maxY) / 2
  const shiftX = 12 - contentCenterX
  const shiftY = 12 - contentCenterY

  ctx.save()
  ctx.translate(offset, offset)
  ctx.scale(scale, scale)
  ctx.translate(shiftX, shiftY)

  // Match SVG: stroke-width="1.5", linecap/linejoin="round", fill="none"
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const pathData of def.paths) {
    const path = new Path2D(pathData)
    ctx.stroke(path)
  }

  ctx.restore()
}

/**
 * Creates a CanvasTexture with the icon drawn synchronously.
 * Uses useMemo so the texture is available immediately on render —
 * no async loading, no race conditions, no Strict Mode issues.
 */
export function useIconTexture(
  iconName: string,
  iconColor: string,
  bgColor: string | undefined,
  iconSizeFraction: number = 0.35,
) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_SIZE
    canvas.height = CANVAS_SIZE
    const ctx = canvas.getContext('2d')!

    // Background
    if (bgColor) {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    } else {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    }

    // Draw icon centered (stroke only, no fill — matching SVG fill="none")
    const iconPx = Math.round(CANVAS_SIZE * iconSizeFraction)
    const offset = (CANVAS_SIZE - iconPx) / 2

    ctx.strokeStyle = iconColor
    drawIcon(ctx, iconName, iconPx, offset)

    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }, [iconName, iconColor, bgColor, iconSizeFraction])

  return texture
}
