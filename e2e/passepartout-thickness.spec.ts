import { test, expect } from '@playwright/test'

import { mapToArtwork, type ExhibitionArtworkResponse } from '@/lib/exhibitionArtworkMapper'
import { PASSEPARTOUT_THICKNESS, isPassepartoutThickness } from '@/lib/passepartoutThickness'

// AR-165 (Eduardo 2026-10-23): the passepartout's thickness goes down to 0.1 cm. He set 0.1, saw
// it saved, baked — still thick — and the editor showed 0.6 again: the mapper reading it back
// from the API kept the old 0.2 floor and put 0.6 in its place. One range, used everywhere.

/** An API row with every field the mapper reads filled in, and the given thickness. */
const row = (passepartoutThickness: number) => {
  const filler = (fields: Record<string, unknown>) =>
    new Proxy(fields, { get: (t, k) => (k in t ? t[k as string] : 'x') })
  return filler({
    passepartoutThickness,
    artwork: filler({ artworkType: 'image', featured: false }),
  }) as unknown as ExhibitionArtworkResponse
}

test('a saved thickness reads back as saved, down to 0.1 cm and up to 3 cm', () => {
  for (const cm of [0.1, 0.2, 0.6, 3])
    expect(mapToArtwork(row(cm)).passepartoutThickness?.value, `${cm} cm`).toBe(cm)
})

test('a thickness the editor cannot set reads as the default board', () => {
  for (const cm of [0, 0.05, 3.5])
    expect(mapToArtwork(row(cm)).passepartoutThickness?.value, `${cm} cm`).toBe(0.6)
})

test('the range is 0.1–3 cm, both ends included', () => {
  expect(PASSEPARTOUT_THICKNESS).toEqual({ min: 0.1, max: 3 })
  expect(isPassepartoutThickness(0.1)).toBe(true)
  expect(isPassepartoutThickness(3)).toBe(true)
  expect(isPassepartoutThickness(0.09)).toBe(false)
  expect(isPassepartoutThickness(undefined)).toBe(false)
})
