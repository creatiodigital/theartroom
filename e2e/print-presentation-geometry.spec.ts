import { test, expect } from '@playwright/test'

import {
  FRAMED_IMAGE_LONG_M,
  SHADOW_MARGIN,
  frameOcclusion,
  imageSize,
  outerSize,
  paperLift,
  shadowReachBelow,
  shotFrame,
  windowFractions,
} from '@/lib/printPresentation/geometry'
import { makeLook, seedForArtwork, type Look } from '@/lib/printPresentation/look'
import { checkShot } from '@/lib/printPresentation/shotCheck'

/**
 * Print presentations: the studio's geometry — sizes in metres, the frame's ambient occlusion on
 * the sheet, the paper's curl, and where the artwork's window lands in the shot.
 * Pure module checks: no server, no WebGL.
 */

test.describe('print presentation geometry', () => {
  test('the framed piece keeps its 75 cm frame; the sheet is the image plus its margin', () => {
    expect(outerSize('framed', 1.5)[0]).toBeCloseTo(0.75, 9)
    expect(outerSize('limited', 1.5)[0]).toBeCloseTo(0.62, 9)
    expect(imageSize(1.5, FRAMED_IMAGE_LONG_M)[0]).toBeCloseTo(0.596, 9)
  })

  test('the frame darkens the sheet right under its lip, and not in the middle', () => {
    const texels = 256
    const ao = frameOcclusion({
      sheetW: 0.716,
      sheetH: 0.5333,
      openW: 0.71,
      openH: 0.5273,
      wallH: 0.02,
      texels,
    })
    const red = (i: number, j: number) => ao[(j * texels + i) * 4]
    const mid = texels / 2
    expect(red(mid, mid)).toBeGreaterThanOrEqual(254)
    expect(red(0, mid)).toBeLessThan(190)
    for (let i = 1; i <= mid; i++) expect(red(i, mid)).toBeGreaterThanOrEqual(red(i - 1, mid))
  })

  test('the paper lies flat under the image and only curls in its border', () => {
    const look = makeLook(1133590978, 'limited', 50)
    const lift = paperLift(look, 0.5, 0.333)
    expect(lift(0, 0)).toBe(0)
    expect(lift(0.2499, 0)).toBe(0)
    expect(lift(0.31, 0.22)).toBeGreaterThan(0)
  })

  test('the window is reported as fractions of the shot', () => {
    expect(windowFractions({ x: 150, y: 100, w: 900, h: 600 }, 1200, 800)).toEqual({
      x: 0.125,
      y: 0.125,
      w: 0.75,
      h: 0.75,
    })
  })

  for (const [mode, ratio] of [
    ['limited', 4],
    ['limited', 0.25],
    ['framed', 4],
    ['framed', 0.25],
  ] as const) {
    test(`a ${ratio === 4 ? 'panorama' : 'tall work'} (${mode}) keeps its window inside the shot, undistorted`, () => {
      const [ow, oh] = outerSize(mode, ratio)
      const pad = SHADOW_MARGIN * Math.max(ow, oh)
      const [iw, ih] = imageSize(ratio, mode === 'framed' ? FRAMED_IMAGE_LONG_M : undefined)
      const { widthPx, baseHeightPx: heightPx } = shotFrame(
        mode,
        ratio,
        1800,
        makeLook(7, mode, 50),
      )
      const w = iw / (ow + 2 * pad)
      const h = ih / (oh + 2 * pad)
      for (const f of [w, h]) {
        expect(f).toBeGreaterThan(0)
        expect(f).toBeLessThan(1)
      }
      expect(Math.abs((w * widthPx) / (h * heightPx) / ratio - 1)).toBeLessThan(0.005)
    })
  }

  test('a level light throws no long shadow: the shot is just the piece and its margin', () => {
    const level: Look = { ...makeLook(7, 'framed', 50), key: [-1, 0, 2.4] }
    expect(shadowReachBelow('framed', level)).toBe(0)
    const frame = shotFrame('framed', 1.5, 1800, level)
    expect(frame.heightPx).toBe(frame.baseHeightPx)
    expect(frame.view.offsetY).toBe(0)
  })

  test('the shot extends below the piece as far as its own shadow reaches, and only below', () => {
    // A tall framed work whose light comes from high up: its shadow ran past the old crop.
    const look = makeLook(seedForArtwork('41317d60-2192-40f8-bfd7-c457a65a716c'), 'framed', 50)
    const frame = shotFrame('framed', 0.8, 1800, look)
    const [ow, oh] = outerSize('framed', 0.8)
    const pad = SHADOW_MARGIN * Math.max(ow, oh)
    const extraRows = frame.heightPx - frame.baseHeightPx
    expect(extraRows).toBeGreaterThan(0)
    // Room below the piece, in metres, covers the shadow's reach.
    const metresPerRow = (oh + 2 * pad) / frame.baseHeightPx
    expect(pad + extraRows * metresPerRow).toBeGreaterThanOrEqual(shadowReachBelow('framed', look))
    // Same camera and pixel density: a frustum made taller symmetrically, of which the shot is
    // the part from the original top down — every pixel of the original crop stays where it was.
    expect(frame.view).toEqual({
      fullWidth: 1800,
      fullHeight: frame.baseHeightPx + 2 * extraRows,
      offsetY: extraRows,
    })
  })

  test("every seed's shadow fits in its shot", () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (const [mode, ratio] of [
        ['framed', 0.75],
        ['framed', 1.5],
        ['limited', 1],
      ] as const) {
        const look = makeLook(seed, mode, 50)
        const frame = shotFrame(mode, ratio, 900, look)
        const [ow, oh] = outerSize(mode, ratio)
        const pad = SHADOW_MARGIN * Math.max(ow, oh)
        const below =
          pad + ((frame.heightPx - frame.baseHeightPx) * (oh + 2 * pad)) / frame.baseHeightPx
        expect(below).toBeGreaterThanOrEqual(shadowReachBelow(mode, look) - 1e-9)
      }
    }
  })

  test('a shot is only stored if it shows a white wall around a transparent window', () => {
    const wall = [255, 255, 255, 255] as const
    const hole = [0, 0, 0, 0] as const
    expect(checkShot({ corner: wall, windowCenter: hole })).toBeNull()
    expect(checkShot({ corner: [253, 253, 253, 255], windowCenter: hole })).toBeNull()
    // Nothing drawn: the whole canvas is still transparent.
    expect(checkShot({ corner: hole, windowCenter: hole })).toMatch(/blank/i)
    // A dark or see-through wall, or something where the artwork goes: not a usable shot.
    expect(checkShot({ corner: [120, 120, 120, 255], windowCenter: hole })).not.toBeNull()
    expect(checkShot({ corner: [255, 255, 255, 128], windowCenter: hole })).not.toBeNull()
    expect(checkShot({ corner: wall, windowCenter: [250, 250, 250, 255] })).toMatch(/window/i)
  })

  test("a shot whose shadow runs into its edge is not stored: no gray line at a card's foot", () => {
    const wall = [255, 255, 255, 255] as const
    const hole = [0, 0, 0, 0] as const
    expect(checkShot({ corner: wall, windowCenter: hole, edgeMin: 253 })).toBeNull()
    expect(checkShot({ corner: wall, windowCenter: hole, edgeMin: 251 })).toBeNull()
    expect(checkShot({ corner: wall, windowCenter: hole, edgeMin: 250 })).toMatch(/edge/i)
  })
})
