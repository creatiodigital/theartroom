import { test, expect } from '@playwright/test'

import { createPaymentIntent } from '@/components/checkout/PrintCheckout/createPaymentIntent'
import { buildArtworkCommerce, COMMERCE_SELECT } from '@/lib/editions/artworkCommerce'
import { galleryCommissionCents } from '@/lib/galleryCommission'
import { buildInitialConfig } from '@/lib/print-providers/configHelpers'
import { buildPrintspaceCatalog, getPrintMinSize } from '@/lib/print-providers/printspace'
import { openEditionFromConfig } from '@/lib/print-providers/printspace/fromConfig'
import { getProviderQuote } from '@/lib/print-providers/quote'
import prisma from '@/lib/prisma'
import { saleFromRow } from '@/lib/editions/artworkSale'
import { getGalleryCommission, getGalleryCommissionRates } from '@/lib/settings'

import {
  setupLimitedFixture,
  setupOpenFixture,
  teardownLimitedFixture,
  teardownOpenFixture,
  type OpenFixture,
} from './edition-helpers'
import { withGalleryCommission } from './gallery-commission-helpers'
import { buyOneLimited, teardownBoughtOrder, type BoughtLimitedOrder } from './order-helpers'
import { cancelPaymentIntent, fixtureAddress } from './stripe-helpers'

/**
 * Admin › Sales › Pricing (docs/admin-redesign/pricing.md): the gallery's commission is the
 * owner's setting, not a constant. What must hold when it changes:
 *
 *   - the artwork page's "From" price, the wizard's first price and the checkout total move
 *     together, each by exactly the change in commission;
 *   - an order already placed keeps the prices it was paid at;
 *   - a failed settings read never drops prices to 0.
 *
 * In-process, against the dev DB (no browser, no WebGL). The commission is set for the length of
 * one test and put back (withGalleryCommission). Payment intents are test-mode and cancelled.
 */

test.describe('the gallery commission setting', () => {
  let open: OpenFixture
  test.beforeAll(async () => {
    open = await setupOpenFixture()
  })
  test.afterAll(async () => {
    await teardownOpenFixture(open)
  })

  test('From price, wizard first price and checkout total follow the setting together', async () => {
    const artwork = await prisma.artwork.findUniqueOrThrow({
      where: { id: open.artworkId },
      select: { originalWidth: true, originalHeight: true, printPriceCents: true },
    })
    const width = artwork.originalWidth!
    const height = artwork.originalHeight!
    const artistPriceCents = artwork.printPriceCents!

    // Two commissions, both unlike any likely live value, so the move is visible.
    const fromAt: Record<number, number> = {}
    for (const pct of [33, 47]) {
      await withGalleryCommission(pct, async () => {
        const rate = (await getGalleryCommissionRates()).open
        expect(rate, 'the app reads the setting just saved').toBe(pct / 100)

        // 1. The artwork page's "From" (the card + edition lines builder).
        const row = await prisma.artwork.findUniqueOrThrow({
          where: { id: open.artworkId },
          select: COMMERCE_SELECT,
        })
        const from = (await buildArtworkCommerce(open.artworkId, row))?.minPriceCents
        expect(from, 'the open edition is priced').toBeGreaterThan(0)

        // 2. The wizard's first price: its opening configuration, priced with the rate its page
        //    reads (the same reader).
        const catalog = buildPrintspaceCatalog({ imageWidthPx: width, imageHeightPx: height })
        const smallest = getPrintMinSize({ width, height })!
        const config = buildInitialConfig(
          catalog,
          width / height,
          null,
          openEditionFromConfig(smallest),
        )
        const first = getProviderQuote('printspace', {
          config,
          country: '',
          artistPriceCents,
          galleryRate: rate,
        }).lines.find((line) => line.id === 'artwork')!.amountCents
        expect(first, 'the wizard opens at the From price').toBe(from)

        // 3. Checkout: the server's authoritative price for that same configuration.
        const res = await createPaymentIntent({
          artworkSlug: open.slug,
          providerId: 'printspace',
          config,
          address: fixtureAddress(`commission-${pct}`),
        })
        expect(res.ok, res.ok ? '' : `createPaymentIntent refused: ${res.error}`).toBe(true)
        if (!res.ok) return
        try {
          const t = res.totals
          expect(t.artistCents, 'the artist keeps their price').toBe(artistPriceCents)
          // The commission, plus under €1 that makes the price a whole euro (the gallery's).
          const commission = galleryCommissionCents(artistPriceCents, pct / 100)
          expect(t.galleryCents).toBeGreaterThanOrEqual(commission)
          expect(t.galleryCents).toBeLessThan(commission + 100)
          expect(from! % 100, 'a whole-euro price').toBe(0)
          expect(
            t.artistCents + t.galleryCents + t.productionCents,
            'the checkout artwork line is the From price',
          ).toBe(from)
        } finally {
          await cancelPaymentIntent(res.paymentIntentId)
        }
        fromAt[pct] = from!
      })
    }

    // By the change in commission, give or take the rounding to a whole euro.
    const change =
      galleryCommissionCents(artistPriceCents, 0.47) -
      galleryCommissionCents(artistPriceCents, 0.33)
    expect(
      Math.abs(fromAt[47] - fromAt[33] - change),
      'the price moved by the change in commission',
    ).toBeLessThan(100)
  })

  test('an order already placed keeps the prices it was paid at', async () => {
    let bought: BoughtLimitedOrder | null = null
    const money = (orderId: string) =>
      prisma.printOrder.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          totalCents: true,
          artistCents: true,
          galleryCents: true,
          productionCents: true,
          customerVatCents: true,
          items: {
            orderBy: { id: 'asc' },
            select: { artistCents: true, galleryCents: true, productionCents: true },
          },
        },
      })
    try {
      bought = await buyOneLimited({ tag: 'commission-placed-order' })
      const before = await money(bought.orderId)
      // Any commission other than the one the order was placed at.
      const other = (await getGalleryCommissionRates()).limited === 0.6 ? 50 : 60

      await withGalleryCommission(
        other,
        async () => {
          expect(await money(bought!.orderId)).toEqual(before)
        },
        other,
      )
      expect(await money(bought.orderId)).toEqual(before)
    } finally {
      await teardownBoughtOrder(bought)
    }
  })

  test('open and limited editions are each priced at their own commission', async () => {
    const limited = await setupLimitedFixture(3)
    try {
      await withGalleryCommission(
        33,
        async () => {
          expect(await getGalleryCommissionRates()).toEqual({ open: 0.33, limited: 0.47 })
          for (const [artworkId, rate] of [
            [open.artworkId, 0.33],
            [limited.artworkId, 0.47],
          ] as const) {
            const row = await prisma.artwork.findUniqueOrThrow({
              where: { id: artworkId },
              select: COMMERCE_SELECT,
            })
            const from = (await buildArtworkCommerce(artworkId, row))?.minPriceCents
            const at = (r: number) => saleFromRow(row, { open: r, limited: r })?.minPriceCents
            expect(from, `${row.editionType}: priced at its own commission`).toBe(at(rate))
            expect(at(0.33), 'the two commissions give different prices').not.toBe(at(0.47))
          }
        },
        47,
      )
    } finally {
      await teardownLimitedFixture(limited)
    }
  })

  test('a failed settings read keeps the last known commission, never 0', async () => {
    const good = await getGalleryCommission()
    expect(good.readFailed, 'the setting can be read (is the dev DB schema synced?)').toBe(false)

    const row = await prisma.artwork.findUniqueOrThrow({
      where: { id: open.artworkId },
      select: COMMERCE_SELECT,
    })
    const fromBefore = (await buildArtworkCommerce(open.artworkId, row))?.minPriceCents

    // Make every settings read fail, in this process only, then put the real one back.
    const delegate = prisma.siteSettings as unknown as { findUnique: unknown }
    const real = delegate.findUnique
    delegate.findUnique = async () => {
      throw new Error('e2e: settings read failed on purpose')
    }
    try {
      const failed = await getGalleryCommission()
      expect(failed.readFailed).toBe(true)
      expect(failed.pct, 'falls back to the last value read, not 0').toBe(good.pct)
      expect(failed.limitedPct, 'the limited one too').toBe(good.limitedPct)

      const fromDuring = (await buildArtworkCommerce(open.artworkId, row))?.minPriceCents
      expect(fromDuring, 'prices stay what they were').toBe(fromBefore)
      expect(fromDuring).toBeGreaterThan(0)
    } finally {
      delegate.findUnique = real
    }
  })
})
