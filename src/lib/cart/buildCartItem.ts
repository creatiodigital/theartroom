import type { ProviderId, Quote, SpecsSummary, WizardConfig } from '@/lib/print-providers'
import type { CartItem } from './types'

type ArtworkMeta = {
  id: string
  slug: string
  title: string
  artistName: string
  thumbnailUrl: string
}

type BuildCartItemInput = {
  artwork: ArtworkMeta
  providerId: ProviderId
  editionType: 'open' | 'limited'
  variantId?: string
  /** Display name of the chosen limited-edition variant (e.g. "Medium"). */
  editionName?: string
  config: WizardConfig
  /** The line's price, and its artist / gallery / production split (`quote.artworkSplit`). */
  quote: Quote
  specsSummary: SpecsSummary
}

/**
 * Builds the non-lineId fields of a CartItem from wizard add-to-cart
 * inputs. Extracted to remove duplication between OpenWizard and
 * LimitedWizard. The price split mirrors the canonical calculation in
 * createPaymentIntent.ts — the server re-derives it at payment.
 */
export function buildCartItem(input: BuildCartItemInput): Omit<CartItem, 'lineId'> {
  const {
    artwork,
    providerId,
    editionType,
    variantId,
    editionName,
    config,
    quote,
    specsSummary,
  } = input

  // The quote's own split: its gallery part carries the rounding to a whole euro, so the three
  // add up to the price the buyer saw.
  const { artistCents, galleryCents, productionCents } = quote.artworkSplit

  return {
    artworkSlug: artwork.slug,
    artworkId: artwork.id,
    providerId,
    editionType,
    ...(variantId !== undefined ? { variantId } : {}),
    ...(editionName !== undefined ? { editionName } : {}),
    config,
    quantity: 1,
    unitArtistCents: artistCents,
    unitProductionCents: productionCents,
    unitGalleryCents: galleryCents,
    thumbnailUrl: artwork.thumbnailUrl,
    title: artwork.title,
    artistName: artwork.artistName,
    specsSummary,
  }
}
