import { plainParagraphsOf } from '@/lib/richText/headingAnchors'
import { SITE_URL } from '@/lib/siteUrl'

import { clip, metaTextOf } from './metaText'
import { SITE_NAME } from './pageMetadata'

/** The print on sale, as the artwork page states it: the buyer-facing figures, in cents. */
type PrintSale = {
  editionType: 'open' | 'limited'
  /** Cheapest completable purchase; null = live but sold out. */
  minPriceCents: number | null
  /** The dearest edition in stock, when the editions differ in price ("€232–€444"). */
  maxPriceCents?: number
}

type ArtworkSeoInput = {
  slug: string
  title: string
  year: string | null
  technique: string | null
  /** The editor's rich-text note. */
  description: string | null
  /** The display copy (never the print master). */
  imageUrl: string | null
  artist: { name: string; handler: string }
  /** Null when no print is on sale (not for sale, an Object, a unique piece). */
  sale: PrintSale | null
}

const absolute = (pathOrUrl: string) => new URL(pathOrUrl, SITE_URL).toString()

/** "Magnolia IX, 2026, by Beatriz Salvatierra." */
const opening = ({ title, year, artist }: ArtworkSeoInput) =>
  `${title}${year ? `, ${year}` : ''}, by ${artist.name}.`

const saleSentence = (sale: PrintSale | null) => {
  if (!sale || sale.minPriceCents == null) return ''
  return sale.editionType === 'limited'
    ? 'Available as a limited-edition fine-art print, numbered, with a certificate of authenticity.'
    : 'Available as a fine-art print, approved by the artist.'
}

/**
 * The artwork page's meta description (AR-193): who made it, whether a print can be ordered, then
 * the artist's note as plain text, cut to a search result's length. It used to be the note's raw
 * HTML ("<p></p>") or, without a note, only "Title" by Artist.
 */
export function artworkMetaDescription(input: ArtworkSeoInput): string {
  // A note is often a fragment ("Matera, Italy"): it ends as a sentence after the other two.
  const note = metaTextOf(input.description, 1000)
  const noteSentence = note && !/[.!?…]$/.test(note) ? `${note}.` : note
  return clip([opening(input), saleSentence(input.sale), noteSentence].filter(Boolean).join(' '))
}

/**
 * schema.org data for the artwork page (AR-193): the work itself (VisualArtwork) and, while a print
 * is on sale, the print (Product) with its price, so a search result can show it and Google
 * Merchant Center can list it. The price is the one the page shows (shipping and VAT added at
 * checkout). A sold-out edition or a work not sold as a print has no Product: Google requires a
 * price on an offer.
 */
export function artworkJsonLd(input: ArtworkSeoInput) {
  const url = absolute(`/artworks/${input.slug}`)
  const image = input.imageUrl ? absolute(input.imageUrl) : undefined
  const note = metaTextOf(input.description, 5000) || undefined
  const creator = {
    '@type': 'Person',
    name: input.artist.name,
    url: absolute(`/artists/${input.artist.handler}`),
  }

  const artwork = {
    '@type': 'VisualArtwork',
    '@id': `${url}#artwork`,
    name: input.title,
    url,
    image,
    creator,
    dateCreated: input.year || undefined,
    // The technique is the editor's rich text too ("<p>FUJIFILM X-S20<br>ISO 400</p>"): its lines,
    // as plain text.
    artMedium: plainParagraphsOf(input.technique ?? '').join(', ') || undefined,
    description: note,
  }

  const sale = input.sale
  if (!sale || sale.minPriceCents == null) {
    return { '@context': 'https://schema.org', ...artwork }
  }

  const euros = (cents: number) => (cents / 100).toFixed(2)
  const product = {
    '@type': 'Product',
    '@id': `${url}#print`,
    name: `${input.title} by ${input.artist.name}, fine-art print`,
    url,
    image,
    description: artworkMetaDescription(input),
    brand: { '@type': 'Brand', name: SITE_NAME },
    subjectOf: { '@id': `${url}#artwork` },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: euros(sale.minPriceCents),
      ...(sale.maxPriceCents != null && { highPrice: euros(sale.maxPriceCents) }),
      availability: 'https://schema.org/InStock',
      url,
      seller: { '@type': 'Organization', name: SITE_NAME, url: absolute('/') },
    },
  }

  return { '@context': 'https://schema.org', '@graph': [artwork, product] }
}
