import { test, expect } from '@playwright/test'
import { estimateVariantMarginCents } from '../src/lib/editions/variantMargin'
import { galleryCommissionCents } from '../src/lib/galleryCommission'

import { TEST_GALLERY_RATE } from './gallery-commission-helpers'

test('the artist’s real variant leaves a healthy margin', () => {
  const m = estimateVariantMarginCents({
    widthCm: 36,
    heightCm: 24,
    borderCm: 7,
    sheetWidthCm: 50,
    sheetHeightCm: 40,
    artistPriceCents: 10000,
    galleryRate: TEST_GALLERY_RATE,
  })!
  expect(m.galleryCutCents).toBe(galleryCommissionCents(10000, TEST_GALLERY_RATE))
  expect(m.absorbedCents).toBeGreaterThan(0)
  expect(m.marginCents).toBeGreaterThan(0)
})

test('a wildly oversized sheet goes negative', () => {
  const m = estimateVariantMarginCents({
    widthCm: 36,
    heightCm: 24,
    borderCm: 7,
    sheetWidthCm: 100,
    sheetHeightCm: 70,
    artistPriceCents: 10000,
    galleryRate: TEST_GALLERY_RATE,
  })!
  expect(m.marginCents).toBeLessThan(0)
})

test('an adaptive variant absorbs only the border ring', () => {
  const m = estimateVariantMarginCents({
    widthCm: 27.9,
    heightCm: 40,
    borderCm: 3,
    artistPriceCents: 10000,
    galleryRate: TEST_GALLERY_RATE,
  })!
  expect(m.absorbedCents).toBeGreaterThan(0)
  expect(m.marginCents).toBeGreaterThan(0)
})
