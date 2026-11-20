import { test, expect } from '@playwright/test'

import { editionLineText } from '@/lib/editions/editionLineText'
import { getVariantEditionLines, variantEditionLineParts } from '@/lib/editions/variantEditionLines'
import prisma from '@/lib/prisma'
import { presentationInputs } from '@/lib/printPresentation/inputs'
import { loadPresentationSources } from '@/lib/printPresentation/loadSources'
import { renderCopy } from '@/lib/printPresentation/photoInputs'

import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * The copy number on the page and in the renders is ONE number (owner, 2026-11-20: "make sure the
 * numbers match in the photo and the description"): the lowest copy not yet PAID for — the one a
 * buyer gets unless someone else is paying at that very moment. An unfinished checkout (a
 * reserved copy) never moves it: the "2 of 50" → "4 of 50" jump an abandoned checkout used to
 * cause is why it counts sold copies only.
 *
 * Database only: no browser, no server.
 */
test.describe('the copy on the page is the copy in the render', () => {
  test('the lowest copy not yet paid for, a reserved one included', async () => {
    const fx = await setupLimitedFixture(5)
    try {
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: 1 },
        data: { state: 'sold' },
      })
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: 2 },
        data: { state: 'reserved' },
      })
      const [source] = await loadPresentationSources({ ids: [fx.artworkId] })
      const [line] = await getVariantEditionLines(fx.artworkId, 0.5)
      expect(renderCopy(source, presentationInputs(source))).toBe(2)
      expect(line.nextCopy).toBe(2)
      expect(editionLineText(variantEditionLineParts(line))).toBe('Edition 2 of 5')
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('sold out: "Edition of 5" on the page, the renders pencil 5/5', async () => {
    const fx = await setupLimitedFixture(5)
    try {
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId },
        data: { state: 'sold' },
      })
      const [source] = await loadPresentationSources({ ids: [fx.artworkId] })
      const [line] = await getVariantEditionLines(fx.artworkId, 0.5)
      expect(renderCopy(source, presentationInputs(source))).toBe(5)
      expect(editionLineText(variantEditionLineParts(line))).toBe('Edition of 5')
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})
