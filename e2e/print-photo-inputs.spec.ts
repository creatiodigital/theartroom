import { test, expect } from '@playwright/test'

import { presentationInputs } from '@/lib/printPresentation/inputs'
import type { SourceRow } from '@/lib/printPresentation/loadSources'
import { photoInputs, pencilledCopy, photoSheet } from '@/lib/printPresentation/photoInputs'

/**
 * Print photo views (2026-11-20): what a work's three photos depend on.
 * - The sheet at the print's REAL size (owner: "not all artworks have the same size, aspect
 *   ratio"): a limited edition's mandatory print size (fixed sheet or adaptive border); anything
 *   else a 50 cm print with a 5 cm margin, within what the file can print.
 * - The pencilled copy is the REAL next unsold one (owner: "we show the closest number the buyer
 *   will buy"): sold out → N/N; no copies created yet (size unpublished) → 1/N.
 * - Their fingerprint has the work's IMAGE in it (the artwork is in these renders), never the copy:
 *   a sale must not make the photos out of date and hide them.
 *
 * Logic only.
 */
const source = (over: Partial<SourceRow> = {}): SourceRow => ({
  id: 'e2e-photo-inputs',
  artworkType: 'image',
  originalWidth: 6000,
  originalHeight: 4020,
  printEnabled: true,
  editionType: 'limited',
  firstVariantEditionSize: 100,
  presentationFrame: 'wood-dark',
  presentationPassepartout: false,
  presentationRatio: null,
  record: null,
  title: 'Passeur',
  artistName: 'John Doe',
  artistId: 'artist',
  accountName: 'John Doe',
  imageUrl: 'https://assets.test/artworks/passeur-1.webp',
  mandatorySize: {
    widthCm: 36,
    heightCm: 24.12,
    borderCm: 7,
    sheetWidthCm: 50,
    sheetHeightCm: 40,
  },
  nextCopy: 1,
  hasCopies: true,
  ...over,
})

test.describe('print photo inputs', () => {
  test('a fixed sheet: the image and margins as the lab prints them', () => {
    const sheet = photoSheet(source(), 1.4925)
    expect(sheet.imageW).toBeCloseTo(36, 2)
    expect(sheet.imageH).toBeCloseTo(24.12, 2)
    expect(sheet.left).toBeCloseTo(7, 2)
    expect(sheet.right).toBeCloseTo(7, 2)
    expect(sheet.top).toBeCloseTo(7.94, 2)
    expect(sheet.bottom).toBeCloseTo(7.94, 2)
  })

  test('an adaptive border: the print size with its border on every side', () => {
    const s = source({
      mandatorySize: { widthCm: 30, heightCm: 20, borderCm: 5, sheetWidthCm: null, sheetHeightCm: null },
    })
    expect(photoSheet(s, 1.5)).toEqual({ imageW: 30, imageH: 20, left: 5, right: 5, top: 5, bottom: 5 })
  })

  test('an open edition: 50 cm on the long side, a 5 cm margin', () => {
    const s = source({ editionType: 'open', mandatorySize: null, originalWidth: 6000, originalHeight: 6000 })
    expect(photoSheet(s, 1)).toEqual({ imageW: 50, imageH: 50, left: 5, right: 5, top: 5, bottom: 5 })
  })

  test('an open edition whose file prints smaller: as large as it prints', () => {
    const s = source({ editionType: 'open', mandatorySize: null, originalWidth: 4800, originalHeight: 3200 })
    const sheet = photoSheet(s, 1.5)
    expect(sheet.imageW).toBeCloseTo(40.64, 2) // 4800 px at 300 dpi
    expect(sheet.imageW / sheet.imageH).toBeCloseTo(1.5, 3)
  })

  test('the pencilled copy is the next unsold one; sold out N; none created yet 1', () => {
    expect(pencilledCopy(source({ nextCopy: 3 }), 100)).toBe(3)
    expect(pencilledCopy(source({ nextCopy: null, hasCopies: true }), 100)).toBe(100)
    expect(pencilledCopy(source({ nextCopy: null, hasCopies: false }), 100)).toBe(1)
  })

  test('a limited sheet with room under the image is numbered; a narrow margin is not', () => {
    const numbered = photoInputs(source(), presentationInputs(source()))!
    expect(numbered.numbered).toBe(true)
    expect(numbered.copy).toBe(1)
    expect(numbered.edition).toBe(100)
    const narrow = source({
      mandatorySize: { widthCm: 30, heightCm: 20, borderCm: 1, sheetWidthCm: null, sheetHeightCm: null },
    })
    const plain = photoInputs(narrow, presentationInputs(narrow))!
    expect(plain.numbered).toBe(false)
    expect(plain.copy).toBeNull()
  })

  test('an open edition is never numbered', () => {
    const s = source({ editionType: 'open', mandatorySize: null, firstVariantEditionSize: null })
    const p = photoInputs(s, presentationInputs(s))!
    expect(p.numbered).toBe(false)
    expect(p.copy).toBeNull()
  })

  test('no web image, or no presentation: no photos', () => {
    const s = source({ imageUrl: null })
    expect(photoInputs(s, presentationInputs(s))).toBeNull()
    const t = source({ artworkType: 'text' })
    expect(photoInputs(t, presentationInputs(t))).toBeNull()
  })

  test('the fingerprint follows the image, the sheet and the seed — never the copy', () => {
    const base = photoInputs(source(), presentationInputs(source()))!
    const fp = (s: SourceRow) => photoInputs(s, presentationInputs(s))!.fingerprint
    expect(base.fingerprint).toMatch(/^[0-9a-f]{8}$/)
    expect(fp(source({ nextCopy: 7 }))).toBe(base.fingerprint)
    expect(fp(source({ imageUrl: 'https://assets.test/artworks/passeur-2.webp' }))).not.toBe(base.fingerprint)
    expect(
      fp(source({ mandatorySize: { widthCm: 30, heightCm: 20, borderCm: 5, sheetWidthCm: null, sheetHeightCm: null } })),
    ).not.toBe(base.fingerprint)
    expect(fp(source({ id: 'another-work' }))).not.toBe(base.fingerprint)
  })
})
