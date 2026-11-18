import type { ArtworkSale } from './artworkSale'
import { formatDisplayPrice } from './formatDisplayPrice'

/**
 * A print's price as the public cards state it (owner, 2026-11-18, White Cube's way): the lowest a
 * print of the work costs, never VAT or shipping, never "From". Open = the smallest size unframed,
 * "€303"; limited = the cheapest edition in stock, or the range to the dearest when they differ,
 * "€445–€653". Null when nothing is left to buy.
 */
export const salePriceLabel = (sale: ArtworkSale): string | null => {
  if (sale.minPriceCents == null) return null
  const low = formatDisplayPrice(sale.minPriceCents)
  return sale.maxPriceCents != null ? `${low}–${formatDisplayPrice(sale.maxPriceCents)}` : low
}

/** "Open edition" / "Limited edition". */
export const editionTypeLabel = (sale: Pick<ArtworkSale, 'editionType'>): string =>
  sale.editionType === 'limited' ? 'Limited edition' : 'Open edition'
