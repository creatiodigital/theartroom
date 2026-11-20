import prisma from '@/lib/prisma'
import { rateForEdition, type GalleryRates } from '@/lib/galleryCommission'
import { getGalleryCommissionRates } from '@/lib/settings'

/**
 * The gallery's commission in specs (pricing.md). Two kinds of spec, two sources, and never a
 * copy of the owner's number:
 *
 * - Specs of the pure math (quote, From price, margin) pass TEST_GALLERY_RATE: they test the
 *   arithmetic at a known rate, so whatever the owner sets in admin can't break them.
 * - Specs that compare against what the app computes (page queries, payment intents) read the
 *   live setting with `liveGalleryRate`, the same reader the app uses.
 * - Specs that need a particular commission set it with `withGalleryCommission`, which puts the
 *   owner's value (and its "Last changed" stamp) back afterwards.
 */
export const TEST_GALLERY_RATE = 0.25

/**
 * Both commissions (open and limited editions each have their own, owner 2026-11-20) for pure specs
 * that price either type. Different on purpose: a work priced at the other type's rate fails.
 */
export const TEST_GALLERY_RATES: GalleryRates = { open: TEST_GALLERY_RATE, limited: 0.3 }

/** Both live commissions, as the page loaders read them. */
export const liveGalleryRates = () => getGalleryCommissionRates()

/** One edition type's live commission rate. */
export const liveGalleryRate = async (editionType: 'open' | 'limited') =>
  rateForEdition(await getGalleryCommissionRates(), editionType)

/**
 * Run `fn` with the open editions' commission at `pct` (and the limited editions' at `limitedPct`
 * when given, else as it was), then restore exactly what was there (values, who and when — or no
 * row at all). The dev DB is shared with staging, so this stays as short as the test, and the e2e
 * suite runs on one worker, so no other spec sees the temporary values.
 */
export async function withGalleryCommission<T>(
  pct: number,
  fn: () => Promise<T>,
  limitedPct?: number,
): Promise<T> {
  const before = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: {
      galleryCommissionPct: true,
      galleryCommissionLimitedPct: true,
      galleryCommissionChangedAt: true,
      galleryCommissionChangedById: true,
    },
  })
  const set = {
    galleryCommissionPct: pct,
    ...(limitedPct !== undefined && { galleryCommissionLimitedPct: limitedPct }),
  }
  await prisma.siteSettings.upsert({ where: { id: 1 }, update: set, create: { id: 1, ...set } })
  try {
    return await fn()
  } finally {
    if (before) {
      await prisma.siteSettings.update({ where: { id: 1 }, data: before })
    } else {
      // There was no settings row: the upsert above made one, all defaults but the commission.
      await prisma.siteSettings.delete({ where: { id: 1 } })
    }
  }
}
