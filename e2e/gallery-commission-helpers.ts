import prisma from '@/lib/prisma'
import { getGalleryCommissionRate } from '@/lib/settings'

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

export const liveGalleryRate = () => getGalleryCommissionRate()

/**
 * Run `fn` with the commission at `pct`, then restore exactly what was there (value, who and
 * when — or no row at all). The dev DB is shared with staging, so this stays as short as the
 * test, and the e2e suite runs on one worker, so no other spec sees the temporary value.
 */
export async function withGalleryCommission<T>(pct: number, fn: () => Promise<T>): Promise<T> {
  const before = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: {
      galleryCommissionPct: true,
      galleryCommissionChangedAt: true,
      galleryCommissionChangedById: true,
    },
  })
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: { galleryCommissionPct: pct },
    create: { id: 1, galleryCommissionPct: pct },
  })
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
