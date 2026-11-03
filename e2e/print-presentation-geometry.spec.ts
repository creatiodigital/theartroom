import { test, expect } from '@playwright/test'

import {
  EDITION_INK_HEIGHT_EM,
  EDITION_NUMBER_CLEARANCE_CM,
  EDITION_NUMBER_FONT_SIZE_CM,
} from '@/components/PrintWizard/editionNumberMetrics'
import {
  FOV,
  FRAMED_BORDER_M,
  FRAMED_BOTTOM_M,
  FRAMED_IMAGE_LONG_M,
  PASSEPARTOUT_REVEAL_M,
  PASSEPARTOUT_THICKNESS_M,
  TILE_FILL,
  cutShade,
  frameOcclusion,
  imageSize,
  outerSize,
  paperLift,
  passepartoutCut,
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

/** The square shot's side, metres, from its camera. */
const tileSide = (frame: { distance: number }) =>
  2 * frame.distance * Math.tan((FOV * Math.PI) / 360)

test.describe('print presentation geometry', () => {
  test('the framed piece is the image, a wide paper margin and a thin frame; the sheet is the image plus its margin', () => {
    expect(outerSize('framed', 1.5)[0]).toBeCloseTo(0.796, 9)
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

  test('the passepartout is a 4 mm board that never covers the image', () => {
    expect(PASSEPARTOUT_THICKNESS_M).toBe(0.004)
    for (const ratio of [1.5, 0.75, 4]) {
      const [iw, ih] = imageSize(ratio, FRAMED_IMAGE_LONG_M)
      const imageY = (FRAMED_BOTTOM_M - FRAMED_BORDER_M) / 2
      for (const numbered of [false, true]) {
        const cut = passepartoutCut(iw, ih, imageY, numbered)
        // A strip of paper between the board and the image, 3 cm on every side…
        expect(PASSEPARTOUT_REVEAL_M).toBe(0.03)
        expect(-iw / 2 - cut.x0).toBeCloseTo(PASSEPARTOUT_REVEAL_M, 9)
        expect(cut.x1 - iw / 2).toBeCloseTo(PASSEPARTOUT_REVEAL_M, 9)
        expect(cut.y1 - (imageY + ih / 2)).toBeCloseTo(PASSEPARTOUT_REVEAL_M, 9)
        expect(imageY - ih / 2 - cut.y0).toBeCloseTo(PASSEPARTOUT_REVEAL_M, 9)
        // …and the board's bevel still well inside the sheet's margin.
        expect(imageY - ih / 2 - cut.y0 + PASSEPARTOUT_THICKNESS_M).toBeLessThan(FRAMED_BOTTOM_M)
      }
    }
  })

  test('below a numbered print the passepartout leaves the pencilled number room, and a little paper under it', () => {
    const [iw, ih] = imageSize(1.5, FRAMED_IMAGE_LONG_M)
    const cut = passepartoutCut(iw, ih, 0, true)
    // The number: 3 mm under the image, its ink EDITION_INK_HEIGHT_EM of its size (PaperSheet's
    // PENCIL_SIZE, 0.75, of EDITION_NUMBER_FONT_SIZE_CM).
    const fontM = (EDITION_NUMBER_FONT_SIZE_CM / 100) * 0.75
    const inkBottom = -ih / 2 - EDITION_NUMBER_CLEARANCE_CM / 100 - EDITION_INK_HEIGHT_EM * fontM
    expect(inkBottom - cut.y0).toBeGreaterThanOrEqual(0.005)
  })

  test("the passepartout's cut shades the paper in a thin line at its foot, and nowhere else", () => {
    const texels = 512
    const sheet = 0.8
    const cut = { x0: -0.3, x1: 0.3, y0: -0.25, y1: 0.25 }
    const shade = cutShade({
      sheetW: sheet,
      sheetH: sheet,
      cut,
      thickness: PASSEPARTOUT_THICKNESS_M,
      texels,
    })
    const at = (x: number, y: number) =>
      shade[
        Math.floor((y / sheet + 0.5) * texels) * texels + Math.floor((x / sheet + 0.5) * texels)
      ]
    // Right at the cut's foot: a visible shade (a few percent of the room's light)…
    expect(at(-0.299, 0)).toBeLessThan(0.95)
    // …gone within a centimetre, and none in the middle or under the board.
    expect(at(-0.29, 0)).toBeGreaterThan(0.98)
    expect(at(0, 0)).toBeGreaterThan(0.999)
    expect(at(-0.35, 0)).toBe(1)
    // Darkest in the window's corners, where two sides meet.
    expect(at(-0.299, -0.249)).toBeLessThan(at(-0.299, 0))
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
      const [iw, ih] = imageSize(ratio, mode === 'framed' ? FRAMED_IMAGE_LONG_M : undefined)
      const frame = shotFrame(mode, ratio, 1800, makeLook(7, mode, 50))
      const { widthPx, heightPx } = frame
      const w = iw / tileSide(frame)
      const h = ih / tileSide(frame)
      for (const f of [w, h]) {
        expect(f).toBeGreaterThan(0)
        expect(f).toBeLessThan(1)
      }
      expect(Math.abs((w * widthPx) / (h * heightPx) / ratio - 1)).toBeLessThan(0.005)
    })
  }

  test('the shot is a square of wall, the piece filling most of it', () => {
    const level: Look = { ...makeLook(7, 'framed', 50), key: [-1, 0, 2.4] }
    expect(shadowReachBelow('framed', level)).toBe(0)
    const frame = shotFrame('framed', 1.5, 1800, level)
    expect(frame.heightPx).toBe(frame.widthPx)
    const [ow, oh] = outerSize('framed', 1.5)
    expect(Math.max(ow, oh) / tileSide(frame)).toBeCloseTo(TILE_FILL, 9)
  })

  test('a long shadow makes the square larger instead of running off its foot', () => {
    // A tall framed work whose light comes from high up: its shadow reaches past the usual wall.
    const look = makeLook(seedForArtwork('41317d60-2192-40f8-bfd7-c457a65a716c'), 'framed', 50)
    const frame = shotFrame('framed', 0.8, 1800, look)
    const [ow, oh] = outerSize('framed', 0.8)
    expect(tileSide(frame)).toBeGreaterThan(Math.max(ow, oh) / TILE_FILL)
    expect((tileSide(frame) - oh) / 2).toBeCloseTo(shadowReachBelow('framed', look), 9)
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
        const [, oh] = outerSize(mode, ratio)
        expect((tileSide(frame) - oh) / 2).toBeGreaterThanOrEqual(
          shadowReachBelow(mode, look) - 1e-9,
        )
      }
    }
  })

  test('a shot is only stored if it shows the light gray wall around a transparent window', () => {
    const wall = [241, 241, 241, 255] as const
    const hole = [0, 0, 0, 0] as const
    expect(checkShot({ corner: wall, windowCenter: hole })).toBeNull()
    expect(checkShot({ corner: [234, 234, 234, 255], windowCenter: hole })).toBeNull()
    // Nothing drawn: the whole canvas is still transparent.
    expect(checkShot({ corner: hole, windowCenter: hole })).toMatch(/blank/i)
    // A dark or see-through wall, or something where the artwork goes: not a usable shot.
    expect(checkShot({ corner: [120, 120, 120, 255], windowCenter: hole })).not.toBeNull()
    expect(checkShot({ corner: [255, 255, 255, 128], windowCenter: hole })).not.toBeNull()
    expect(checkShot({ corner: wall, windowCenter: [250, 250, 250, 255] })).toMatch(/window/i)
  })

  test("a shot whose shadow runs into its edge is not stored: no dark line at a tile's foot", () => {
    const wall = [241, 241, 241, 255] as const
    const hole = [0, 0, 0, 0] as const
    expect(checkShot({ corner: wall, windowCenter: hole, edgeMin: 240 })).toBeNull()
    expect(checkShot({ corner: wall, windowCenter: hole, edgeMin: 237 })).toBeNull()
    expect(checkShot({ corner: wall, windowCenter: hole, edgeMin: 236 })).toMatch(/edge/i)
  })
})
