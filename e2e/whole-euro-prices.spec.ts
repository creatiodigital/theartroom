import { test, expect } from '@playwright/test'

import { minimumPriceForLimited, minimumPriceForOpen } from '@/lib/editions/minimumPrice'
import { galleryCommissionCents, roundedGalleryCommissionCents } from '@/lib/galleryCommission'
import { getProviderQuote } from '@/lib/print-providers/quote'
import type { WizardConfig } from '@/lib/print-providers/types'

import { TEST_GALLERY_RATE } from './gallery-commission-helpers'

/**
 * A print's price before tax and shipping is a whole euro (owner, 2026-11-20: "showing decimal
 * numbers in prices looks cheap"; €210.50 → €211). The quote rounds it UP, the gallery keeps the
 * cents, and every price — the "From", the wizard, the cart, the charge — is that rounded quote.
 * Tax and shipping come after and may have cents. Pure math, no browser or database.
 */

const print = (widthCm: number, heightCm: number, values: Record<string, string> = {}) =>
  ({
    values: { format: 'print-only', paper: 'hahnemuhle-german-etching', ...values },
    customSize: { widthCm, heightCm },
  }) as unknown as WizardConfig

const framed = (widthCm: number, heightCm: number) =>
  print(widthCm, heightCm, {
    format: 'framing',
    frameType: 'box',
    glass: 'anti-reflective',
    hanging: 'd-rings-cord',
    windowMount: 'white',
    windowMountSize: 'large',
  })

const CONFIGS: [string, WizardConfig][] = [
  ['small print', print(26.7, 20)],
  ['odd-size print', print(41.3, 27.9)],
  ['large print', print(100, 66.7)],
  ['framed with mount and AR glass', framed(45, 30)],
]
const ARTIST_PRICES = [15000, 15050, 19999, 20000, 33300]
const RATES = [TEST_GALLERY_RATE, 0.275, 0.333, 0]

test.describe('whole-euro prices', () => {
  test('roundedGalleryCommissionCents rounds the price up, never down', () => {
    // Lucie's €150 at 25%: 150 + 37.50 + production 23.00 = €210.50 → €211.
    expect(roundedGalleryCommissionCents(15000, 0.25, 2300)).toBe(3800)
    // Already whole: nothing added.
    expect(roundedGalleryCommissionCents(20000, 0.25, 2300)).toBe(5000)
    // One cent over a euro goes to the next euro.
    expect(roundedGalleryCommissionCents(20000, 0.25, 2301)).toBe(5099)
  })

  for (const [name, config] of CONFIGS) {
    test(`${name}: the artwork line is a whole euro and its split adds up`, () => {
      for (const artistPriceCents of ARTIST_PRICES) {
        for (const galleryRate of RATES) {
          const quote = getProviderQuote('printspace', {
            config,
            country: '',
            artistPriceCents,
            galleryRate,
          })
          const line = quote.lines.find((l) => l.id === 'artwork')!.amountCents
          const { artistCents, galleryCents, productionCents } = quote.artworkSplit
          const at = `${artistPriceCents} @ ${galleryRate}`

          expect(line % 100, `whole euro, ${at}`).toBe(0)
          expect(artistCents + galleryCents + productionCents, `split = line, ${at}`).toBe(line)
          expect(artistCents, `the artist's price is untouched, ${at}`).toBe(artistPriceCents)
          const commission = galleryCommissionCents(artistPriceCents, galleryRate)
          expect(galleryCents - commission, `the gallery gets under €1 more, ${at}`).toBeGreaterThanOrEqual(0)
          expect(galleryCents - commission, `the gallery gets under €1 more, ${at}`).toBeLessThan(100)
        }
      }
    })
  }

  test('with a destination the artwork line stays the same whole euro; tax and shipping follow', () => {
    const config = print(41.3, 27.9)
    const input = { config, artistPriceCents: 15000, galleryRate: TEST_GALLERY_RATE }
    const bare = getProviderQuote('printspace', { ...input, country: '' })
    const spain = getProviderQuote('printspace', { ...input, country: 'ES' })
    const line = (q: typeof bare) => q.lines.find((l) => l.id === 'artwork')!.amountCents

    expect(line(spain)).toBe(line(bare))
    expect(spain.artworkSplit).toEqual(bare.artworkSplit)
    const shipping = spain.lines.find((l) => l.id === 'shipping')!.amountCents
    expect(spain.subtotalCents).toBe(line(spain) + shipping)
    expect(spain.totalCents).toBe(spain.subtotalCents + spain.taxCents)
  })

  test('the "From" figures are whole euros', () => {
    const open = minimumPriceForOpen(
      { printPriceCents: 15050, originalWidth: 6000, originalHeight: 4000 },
      TEST_GALLERY_RATE,
    )!
    expect(open.cents % 100).toBe(0)

    const limited = minimumPriceForLimited(
      [
        {
          name: 'Small',
          paperId: 'hahnemuhle-german-etching',
          printTypeId: 'giclee',
          widthCm: 30,
          heightCm: 20,
          borderCm: 3,
          sheetWidthCm: null,
          sheetHeightCm: null,
          priceCents: 19999,
        },
      ],
      TEST_GALLERY_RATE,
    )!
    expect(limited.cents % 100).toBe(0)
  })
})
