import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'
import { getVariantEditionLines, variantEditionLineParts } from '@/lib/editions/variantEditionLines'
import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'
import { liveGalleryRate } from './gallery-commission-helpers'

/**
 * The edition rows of the artwork page's print block (units.md, owner 2026-11-17): the size, then
 * "Medium · Edition of 30 · 28 left", the price.
 *
 * "28 left" counts SOLD copies only. The consequence worth testing is that a reservation — an
 * unfinished or abandoned checkout — never moves it; only a sale does. (A count of available
 * numbers once moved a live edition with nothing sold.)
 *
 * Pure function, no DB, no page.
 */
test.describe('variantEditionLineParts', () => {
  const line = (soldOut: boolean, priceCents: number | null = 31200) => ({
    variantName: 'Medium',
    editionSize: 30,
    left: soldOut ? 0 : 28,
    // The copy a buyer gets next: copies 1 and 2 sold.
    nextCopy: soldOut ? null : 3,
    soldOut,
    priceCents,
    widthCm: 36,
    heightCm: 24,
    paperId: 'hahnemuhle-german-etching',
  })

  test('gives the size, the edition, the copies left and the price', () => {
    expect(variantEditionLineParts(line(false))).toEqual({
      name: 'Medium',
      paper: 'Hahnemühle German Etching',
      widthCm: 36,
      heightCm: 24,
      editionSize: 30,
      left: 28,
      nextCopy: 3,
      soldOut: false,
      price: '\u20ac312',
    })
  })

  test('an exhausted edition says so', () => {
    expect(variantEditionLineParts(line(true)).soldOut).toBe(true)
  })

  test('an unpriceable variant yields no figure rather than a zero', () => {
    expect(variantEditionLineParts(line(false, null)).price).toBeNull()
  })
})

test.describe('getVariantEditionLines', () => {
  test('an abandoned checkout leaves the row untouched', async () => {
    const fx = await setupLimitedFixture(50)
    try {
      const [before] = await getVariantEditionLines(fx.artworkId, await liveGalleryRate('limited'))
      expect(before.left).toBe(50)

      // Two visitors reach payment and abandon. A number is reserved the moment
      // a PaymentIntent is created, but NOTHING WAS PAID — only the Stripe
      // webhook marks a copy `sold`.
      //
      // This once moved a live edition from "2 of 50" to "4 of 50" with nothing
      // sold, because the row read the lowest AVAILABLE number and reservations
      // are not available. "Left" counts sold copies only, so a reservation has
      // nothing to move — this proves that, rather than trusting it.
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: { in: [1, 2] } },
        data: { state: 'reserved' },
      })
      const [after] = await getVariantEditionLines(fx.artworkId, await liveGalleryRate('limited'))
      expect(after.soldOut, 'a held copy is not a sold one').toBe(false)
      expect(after.left, 'a held copy is still left').toBe(50)

      // A real sale is what moves it.
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: 1 },
        data: { state: 'sold' },
      })
      const [sold] = await getVariantEditionLines(fx.artworkId, await liveGalleryRate('limited'))
      expect(sold.left).toBe(49)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('counts sales, gives back a returned copy, and sells out when all are sold', async () => {
    const fx = await setupLimitedFixture(5)
    const sell = (numbers: number[]) =>
      prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: { in: numbers } },
        data: { state: 'sold' },
      })
    try {
      let [line] = await getVariantEditionLines(fx.artworkId, await liveGalleryRate('limited'))
      expect(line.editionSize).toBe(5)
      expect(line.soldOut).toBe(false)

      // Copies sell; the row counts them.
      await sell([1, 2, 3])
      ;[line] = await getVariantEditionLines(fx.artworkId, await liveGalleryRate('limited'))
      expect(line.soldOut).toBe(false)
      expect(line.left).toBe(2)

      // Copy 2's order is cancelled and its number goes back to the pool. This
      // is the case `max(sold) + 1` gets wrong — it would answer 5, while
      // reserveEditionNumber will actually hand out 2.
      await prisma.editionNumber.updateMany({
        where: { variantId: fx.variantId, number: 2 },
        data: { state: 'available' },
      })
      ;[line] = await getVariantEditionLines(fx.artworkId, await liveGalleryRate('limited'))
      expect(line.soldOut, 'a returned copy is not sold out').toBe(false)
      expect(line.left).toBe(3)

      // Every copy gone — counted, so a gap in the numbering cannot fake it.
      await sell([2, 4, 5])
      ;[line] = await getVariantEditionLines(fx.artworkId, await liveGalleryRate('limited'))
      expect(line.soldOut).toBe(true)
      expect(line.left).toBe(0)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})
