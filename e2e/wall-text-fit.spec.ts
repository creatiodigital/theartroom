import { test, expect } from '@playwright/test'

import {
  comfortableHeight,
  fitOf,
  neededHeight,
  type WallTextStyle,
} from '../src/components/wallview/textFit'

// AR-182: whether a wall text fits its box. A text may run into its own spacing; it doesn't fit
// only when at least half a line leaves the box (the owner's text, 2026-11-14: "it fits
// perfectly", where the old rule, text inside box minus both spacings, said one line too long).
// Pure arithmetic on a measured height, no browser.

// The owner's text: size 3.5, line height 1.6 (5.6 a line), 8 of spacing all round, 7 lines.
const style: WallTextStyle = {
  fontSize: 3.5,
  lineHeight: 1.6,
  letterSpacing: 0,
  fontFamily: 'crimson',
  fontWeight: 'regular',
  padTop: 8,
  padBottom: 8,
  padLeft: 8,
  padRight: 8,
}
const sevenLines = 7 * 5.6 // 39.2
const box = 51.4545

test("the owner's text fits: it runs into the bottom spacing, never out of the box", () => {
  expect(neededHeight(sevenLines, style)).toBeCloseTo(47.2)
  expect(fitOf(sevenLines, style, box)).toEqual({ fits: true, linesOver: 0, height: sevenLines })
})

test('by where the text sits: top, middle, bottom', () => {
  const uneven = { ...style, padTop: 4, padBottom: 12 }
  expect(neededHeight(10, { ...uneven, verticalAlign: 'top' })).toBe(14)
  expect(neededHeight(10, { ...uneven, verticalAlign: 'bottom' })).toBe(22)
  expect(neededHeight(10, { ...uneven, verticalAlign: 'center' })).toBe(18)
})

test("less than half a line outside: left to the artist's eye", () => {
  // 8 + 9 lines (50.4) = 58.4: 7 over the box, 1.25 lines; 8 + 8 lines = 52.8: 1.35 over, 0.24 line.
  expect(fitOf(8 * 5.6, style, box).fits).toBe(true)
  expect(fitOf(9 * 5.6, style, box)).toEqual({ fits: false, linesOver: 1, height: 9 * 5.6 })
  expect(fitOf(12 * 5.6, style, box).linesOver).toBe(4)
})

test('Make the box taller gives the text all its top and bottom spacing', () => {
  expect(comfortableHeight(sevenLines, style)).toBeCloseTo(55.2)
})
