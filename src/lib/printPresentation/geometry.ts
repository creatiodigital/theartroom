import type { Look, PresentationMode } from './look'

/**
 * The print-presentation studio's geometry, in metres: the piece, its frame or sheet, the shot
 * around it, and the frame's shade on the sheet. 🔒 Approved values (2026-10-28) — don't retune.
 */

/** The image's long side, metres: a typical gallery print. */
export const IMAGE_LONG_M = 0.5
// Framed (open editions): the sheet straight behind the frame — no mat, just the paper's margin.
export const FRAME_FACE_M = 0.02
export const FRAME_DEPTH_M = 0.05
/** How far the frame's lip covers the sheet's edge. */
export const LIP_OVERLAP_M = 0.003
/**
 * The framed image's long side. The frame keeps the size it had with a 4.5 cm mat around the
 * sheet; without the mat that room goes to the image (the paper margin stays the same).
 */
export const FRAMED_IMAGE_LONG_M = IMAGE_LONG_M + 2 * (0.045 + LIP_OVERLAP_M)
// The paper margin around the image (a little more at the bottom of a framed sheet, as printed).
export const PAPER_BORDER_M = 0.06
export const PAPER_BOTTOM_M = 0.075
export const PAPER_THICKNESS_M = 0.0004

/**
 * What the wall receives in total, in three.js irradiance units: a white matte wall reflects
 * E / π, so this lands it just on white (not past it, or the faint shadows clip away).
 */
export const WALL_IRRADIANCE = Math.PI * 0.995

export const FOV = 30
/** Room around the piece for its shadow, as a share of its longer side. */
export const SHADOW_MARGIN = 0.06

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
  return [iw + 2 * PAPER_BORDER_M + frame, ih + PAPER_BORDER_M + PAPER_BOTTOM_M + frame]
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

/** The shot: canvas size, camera, and the part of a taller view the canvas shows. */
export type ShotFrame = {
  widthPx: number
  heightPx: number
  /** The shot without its extension below: the piece and its margin all round. */
  baseHeightPx: number
  distance: number
  /** Vertical field of view of the full (symmetric) view, degrees. */
  fov: number
  /** `camera.setViewOffset(fullWidth, fullHeight, 0, offsetY, widthPx, heightPx)`. */
  view: { fullWidth: number; fullHeight: number; offsetY: number }
}

/**
 * The shot is cropped to the piece: its own proportions plus a margin for the shadow, so the
 * piece fills the card. Camera dead-on; the vertical extent fits the frame exactly. Below the
 * piece, the shot reaches as far as its shadow does — a steep light behind a deep frame throws a
 * soft shadow past the margin, and a crop through it would leave a gray line at the card's foot.
 * The extension is the same camera's view made taller: every pixel of the margin-only shot stays
 * where it was; the shot just gains wall at the bottom.
 */
export function shotFrame(
  mode: PresentationMode,
  ratio: number,
  widthPx: number,
  look: Look,
): ShotFrame {
  const [ow, oh] = outerSize(mode, ratio)
  const pad = SHADOW_MARGIN * Math.max(ow, oh)
  const shotW = ow + 2 * pad
  const shotH = oh + 2 * pad
  const baseHeightPx = Math.round((widthPx * shotH) / shotW)
  const distance = shotH / 2 / Math.tan((FOV * Math.PI) / 360)
  const extraM = Math.max(0, shadowReachBelow(mode, look) - pad)
  const extraPx = Math.ceil((extraM * baseHeightPx) / shotH)
  const fullHeight = baseHeightPx + 2 * extraPx
  const fov = (2 * Math.atan(((shotH / 2) * fullHeight) / baseHeightPx / distance) * 180) / Math.PI
  return {
    widthPx,
    heightPx: baseHeightPx + extraPx,
    baseHeightPx,
    distance,
    // Exactly the approved camera when there is nothing to add.
    fov: extraPx === 0 ? FOV : fov,
    view: { fullWidth: widthPx, fullHeight, offsetY: extraPx },
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
