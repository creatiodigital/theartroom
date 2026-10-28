import type { Look, PresentationMode } from './look'

/**
 * The print-presentation studio's geometry, in metres: the piece, its frame or sheet, the shot
 * around it, and the frame's shade on the sheet. 🔒 Approved values (2026-10-28) — don't retune.
 * Refined the same day after the owner compared them with a gallery's own print photos: a thinner
 * frame, a wider paper margin, a light gray wall, the piece centred in a square of it.
 */

/** The image's long side, metres: a typical gallery print. */
export const IMAGE_LONG_M = 0.5
// Framed (open editions): the sheet straight behind the frame — no mat, just the paper's margin.
export const FRAME_FACE_M = 0.013
export const FRAME_DEPTH_M = 0.05
/** How far the frame's lip covers the sheet's edge. */
export const LIP_OVERLAP_M = 0.003
/**
 * The framed image's long side. The frame keeps the size it had with a 4.5 cm mat around the
 * sheet; without the mat that room goes to the image (the paper margin stays the same).
 */
export const FRAMED_IMAGE_LONG_M = IMAGE_LONG_M + 2 * (0.045 + LIP_OVERLAP_M)
/** The limited-edition sheet's paper margin around the image. */
export const PAPER_BORDER_M = 0.06
/** The framed sheet's paper margin: wider, a little more at the bottom, as printed. */
export const FRAMED_BORDER_M = 0.09
export const FRAMED_BOTTOM_M = 0.105
export const PAPER_THICKNESS_M = 0.0004

/**
 * What the wall receives in total, in three.js irradiance units: a white matte wall reflects
 * E / π, so this lands it just on white (not past it, or the faint shadows clip away).
 */
export const WALL_IRRADIANCE = Math.PI * 0.995
/** The wall's paint: a light gray, so the white paper reads against it (it renders ≈ 241). */
export const WALL_COLOR = '#f2f2f2'

export const FOV = 30
/** The piece's longer side, as a share of the square shot's: wall all round it. */
export const TILE_FILL = 0.82

/** Light the frame's wood sends back onto the paper, of what its inner walls hide. */
export const WOOD_BOUNCE = 0.3
/** Eased edges: a real moulding is never knife-sharp, and its edges catch a line of light. */
export const EASE_M = 0.0008

/** Where the artwork's window sits in the shot, as fractions of its width and height. */
export type PresentationWindow = { x: number; y: number; w: number; h: number }

export const imageSize = (ratio: number, long = IMAGE_LONG_M): [number, number] =>
  ratio >= 1 ? [long, long / ratio] : [long * ratio, long]

/** Outer size of the piece, metres: what the camera has to fit. */
export function outerSize(mode: PresentationMode, ratio: number): [number, number] {
  if (mode === 'limited') {
    const [iw, ih] = imageSize(ratio)
    return [iw + 2 * PAPER_BORDER_M, ih + 2 * PAPER_BORDER_M]
  }
  const [iw, ih] = imageSize(ratio, FRAMED_IMAGE_LONG_M)
  const frame = 2 * (FRAME_FACE_M - LIP_OVERLAP_M)
  return [iw + 2 * FRAMED_BORDER_M + frame, ih + FRAMED_BORDER_M + FRAMED_BOTTOM_M + frame]
}

/**
 * How far below the piece its lowest shadow can reach on the wall, metres: the bottom edge's
 * offset (how far it stands off the wall, times the key light's slope) and the soft penumbra
 * beyond it, which is about as long again and a bit more.
 */
export const SHADOW_REACH = 2.5
export function shadowReachBelow(mode: PresentationMode, look: Look): number {
  const offWall =
    mode === 'framed'
      ? look.standoff + FRAME_DEPTH_M
      : look.standoff + PAPER_THICKNESS_M + Math.max(...look.cornerLift) + look.edgeLift
  const [, y, z] = look.key
  return SHADOW_REACH * offWall * Math.max(0, y / z)
}

/** The shot: a square canvas, and the camera that fits it. */
export type ShotFrame = {
  widthPx: number
  heightPx: number
  distance: number
  /** Vertical field of view, degrees. */
  fov: number
}

/**
 * The shot is a square of wall with the piece in its middle, as a gallery photographs its prints.
 * Camera dead-on. The square grows (the piece gets a little smaller in it) when the piece's shadow
 * would otherwise run past its foot: a steep light behind a deep frame throws it far, and a crop
 * through it would leave a dark line at the tile's edge.
 */
export function shotFrame(
  mode: PresentationMode,
  ratio: number,
  widthPx: number,
  look: Look,
): ShotFrame {
  const [ow, oh] = outerSize(mode, ratio)
  const side = Math.max(Math.max(ow, oh) / TILE_FILL, oh + 2 * shadowReachBelow(mode, look))
  return {
    widthPx,
    heightPx: widthPx,
    distance: side / 2 / Math.tan((FOV * Math.PI) / 360),
    fov: FOV,
  }
}

/**
 * The room's ambient light on the sheet, as the frame lets it through (RGBA texels). A point on
 * the sheet a distance d from an inner wall that rises h in front of it loses
 * (1 − d / √(d² + h²)) / 2 of its ambient light to that wall (the wall's view factor) — half of it
 * right at the wall, fading within a few centimetres. The wood bounces some back. Used as the
 * sheet's aoMap, so it dims only the ambient light; the lights' own shadows come from the shadow
 * maps.
 */
export function frameOcclusion(o: {
  sheetW: number
  sheetH: number
  openW: number
  openH: number
  wallH: number
  texels: number
}): Uint8Array {
  const { sheetW, sheetH, openW, openH, wallH, texels: n } = o
  const data = new Uint8Array(n * n * 4)
  const blocked = (d: number) => (d <= 0 ? 0.5 : (1 - d / Math.hypot(d, wallH)) / 2)
  for (let j = 0; j < n; j++) {
    const y = ((j + 0.5) / n - 0.5) * sheetH
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n - 0.5) * sheetW
      const lost =
        blocked(x + openW / 2) +
        blocked(openW / 2 - x) +
        blocked(y + openH / 2) +
        blocked(openH / 2 - y)
      const ao = 1 - (1 - WOOD_BOUNCE) * Math.min(lost, 0.75)
      const k = (j * n + i) * 4
      data[k] = data[k + 1] = data[k + 2] = Math.round(ao * 255)
      data[k + 3] = 255
    }
  }
  return data
}

/**
 * The limited-edition sheet's curl: 0 on the image and up to its edge, easing off the wall
 * towards the paper's edge and corners (paper never lies perfectly flat).
 */
export function paperLift(look: Look, iw: number, ih: number): (x: number, y: number) => number {
  const pw = iw + 2 * PAPER_BORDER_M
  const ph = ih + 2 * PAPER_BORDER_M
  const corners: [number, number][] = [
    [-pw / 2, ph / 2],
    [pw / 2, ph / 2],
    [-pw / 2, -ph / 2],
    [pw / 2, -ph / 2],
  ]
  const reach = 0.3 * Math.max(pw, ph)
  return (x, y) => {
    const dx = Math.max(0, Math.abs(x) - iw / 2) / PAPER_BORDER_M
    const dy = Math.max(0, Math.abs(y) - ih / 2) / PAPER_BORDER_M
    const t = Math.min(1, Math.hypot(dx, dy))
    const curl = corners.reduce(
      (sum, [cx, cy], i) =>
        sum + look.cornerLift[i] * Math.exp(-((Math.hypot(x - cx, y - cy) / reach) ** 2)),
      look.edgeLift,
    )
    return t * t * curl
  }
}

/** The wall a page keeps round the piece when it crops the shot to it, metres: room for the
 *  piece's shadow, which fades within a few centimetres. */
export const CROP_WALL_M = 0.06

/**
 * The piece with a thin border of wall round it, as fractions of the shot: what a page that shows
 * the work as large as it can (the artwork page) crops the square shot to. Worked out from where
 * the image's window landed in the shot and the piece's own borders round the image, so it needs
 * nothing a stored render doesn't already have.
 */
export function pieceArea(
  mode: PresentationMode,
  ratio: number,
  window: PresentationWindow,
): PresentationWindow {
  const [iw] = imageSize(ratio, mode === 'framed' ? FRAMED_IMAGE_LONG_M : IMAGE_LONG_M)
  // The shot is square, so one scale serves both ways: shot widths per metre.
  const s = window.w / iw
  const face = FRAME_FACE_M - LIP_OVERLAP_M
  const [side, top, bottom] =
    mode === 'framed'
      ? [FRAMED_BORDER_M + face, FRAMED_BORDER_M + face, FRAMED_BOTTOM_M + face]
      : [PAPER_BORDER_M, PAPER_BORDER_M, PAPER_BORDER_M]
  const x0 = Math.max(0, window.x - (side + CROP_WALL_M) * s)
  const x1 = Math.min(1, window.x + window.w + (side + CROP_WALL_M) * s)
  const y0 = Math.max(0, window.y - (top + CROP_WALL_M) * s)
  const y1 = Math.min(1, window.y + window.h + (bottom + CROP_WALL_M) * s)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** A pixel rect in the shot, as fractions of it. */
export function windowFractions(
  rectPx: { x: number; y: number; w: number; h: number },
  canvasW: number,
  canvasH: number,
): PresentationWindow {
  return {
    x: rectPx.x / canvasW,
    y: rectPx.y / canvasH,
    w: rectPx.w / canvasW,
    h: rectPx.h / canvasH,
  }
}
