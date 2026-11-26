import type { ArtworkSale } from '@/lib/editions/artworkSale'

/**
 * A print that can be ordered now among these works (the grid's Order print shows): Take a peek's
 * strip goes only above such works. Sold out (`minPriceCents: null`) and not-for-sale works don't
 * count.
 */
export const hasPrintOnSale = (works: { sale?: ArtworkSale | null }[]) =>
  works.some((work) => work.sale != null && work.sale.minPriceCents != null)
