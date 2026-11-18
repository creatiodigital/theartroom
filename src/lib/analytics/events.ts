/**
 * The public site's GA4 events, built on `track()` (./track.ts). The tracking plan, with every
 * event, its parameters and the GA4 setup it needs, is docs/analytics/README.md.
 *
 * Money is sent in euros (GA4 wants a number in the currency's unit, not cents); the gallery
 * sells in EUR only.
 */
import { cartSubtotal, lineTotal } from '@/lib/cart/cartMath'
import type { CartItem } from '@/lib/cart/types'

import { track, type AnalyticsItem, type AnalyticsParams } from './track'

export const CURRENCY = 'EUR'

export const euros = (cents: number): number => Math.round(cents) / 100

export const editionCategory = (editionType: 'open' | 'limited'): string =>
  editionType === 'limited' ? 'Limited edition' : 'Open edition'

/** "Medium" for a limited edition; "40×30 cm" (height × width) for an open one. */
const variantOf = (item: Pick<CartItem, 'editionType' | 'editionName' | 'config'>) => {
  if (item.editionType === 'limited') return item.editionName
  const size = item.config.customSize
  return size ? `${Math.round(size.heightCm)}×${Math.round(size.widthCm)} cm` : undefined
}

/** A cart line (or one about to be added: no line id yet) as a GA4 ecommerce item. */
type CartLineForGa = Omit<CartItem, 'lineId'>

export const cartItemToGa = (item: CartLineForGa, index?: number): AnalyticsItem => ({
  item_id: item.artworkSlug,
  item_name: item.title,
  item_brand: item.artistName,
  item_category: editionCategory(item.editionType),
  item_variant: variantOf(item),
  price: euros(lineTotal(item).unitItemCents),
  quantity: item.quantity,
  index,
})

/** An artwork that isn't a cart line yet (artwork page, room details, wizard). */
export type ArtworkForGa = {
  slug: string
  title: string
  artistName?: string
  editionType?: 'open' | 'limited'
  priceCents?: number | null
}

export const artworkToGa = (artwork: ArtworkForGa): AnalyticsItem => ({
  item_id: artwork.slug,
  item_name: artwork.title,
  item_brand: artwork.artistName,
  item_category: artwork.editionType ? editionCategory(artwork.editionType) : undefined,
  price: artwork.priceCents ? euros(artwork.priceCents) : undefined,
})

type CartEvent = 'add_to_cart' | 'remove_from_cart' | 'view_cart' | 'begin_checkout'

/** A GA4 ecommerce event over cart lines: value = the lines' item total (no shipping, no VAT). */
export const trackCartEvent = (
  name: CartEvent,
  items: CartLineForGa[],
  extra: AnalyticsParams = {},
) =>
  track(name, {
    currency: CURRENCY,
    value: euros(cartSubtotal(items)),
    items: items.map((item, index) => cartItemToGa(item, index)),
    ...extra,
  })

/** Where the visitor is, for events that can fire from several places. */
export const pageArea = (pathname: string): string => {
  if (pathname === '/') return 'home'
  if (/^\/exhibitions\/[^/]+\/[^/]+\/visit/.test(pathname)) return 'room'
  if (/^\/exhibitions\/[^/]+\/[^/]+/.test(pathname)) return 'exhibition'
  if (/^\/artworks\/[^/]+\/print/.test(pathname)) return 'print_wizard'
  if (/^\/artworks\//.test(pathname)) return 'artwork'
  const first = pathname.split('/')[1]
  return first || 'home'
}

/**
 * Sends an event at most once per browser tab for `key`, so a reload or a re-render never
 * counts it twice (a purchase, a confirmation). sessionStorage, so a new tab can count it again.
 */
export const trackOnce = (key: string, name: string, params: AnalyticsParams = {}) => {
  const storageKey = `the-art-room:ga-once:${key}`
  try {
    if (sessionStorage.getItem(storageKey)) return
    sessionStorage.setItem(storageKey, '1')
  } catch {
    // No storage: send it; a duplicate is better than nothing.
  }
  track(name, params)
}
