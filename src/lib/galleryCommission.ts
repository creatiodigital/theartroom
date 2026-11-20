/**
 * The gallery's commission on a print — the one formula every price uses (pricing.md).
 *
 * The PERCENT is the owner's to set in Admin › Sales › Pricing (SiteSettings.galleryCommissionPct,
 * read on the server by `getGalleryCommissionRate` in ./settings). Everything that prices a print
 * takes the resulting RATE (percent / 100) as an input instead of importing a constant: the quote,
 * the cart line, the checkout's authoritative re-price, the limited-edition margin check, the
 * "From" figures. Specs read the same setting or pass a rate, never a copy of the number.
 *
 * It is a markup ON TOP of the artist's price, not a share of the sale: at 25% the buyer's artwork
 * price is artist × 1.25 (+ production) and the artist keeps their whole price.
 *
 * Pure: safe in the browser (the wizard prices client-side with the rate its page handed it).
 */

/** The commission until the owner sets one. Must match SiteSettings.galleryCommissionPct's @default. */
export const DEFAULT_GALLERY_COMMISSION_PCT = 25

export const GALLERY_COMMISSION_MIN_PCT = 0
export const GALLERY_COMMISSION_MAX_PCT = 100

/** What the gallery adds on top of the artist's price, in cents. */
export const galleryCommissionCents = (artistPriceCents: number, galleryRate: number): number =>
  Math.round(artistPriceCents * galleryRate)

/**
 * The commission a buyer's price actually carries: `galleryCommissionCents` plus the cents that
 * bring the price before tax and shipping (artist + commission + production) UP to a whole euro.
 * Owner, 2026-11-20: "showing decimal numbers in prices looks cheap" — €210.50 is €211. The gallery
 * keeps those cents (under €1); the artist's price and the production cost stay exact. The quote
 * is the only caller, so the "From" figures, the wizard, the cart and the charge all carry the
 * same whole-euro price. Tax and shipping are added after, and may have cents.
 */
export const roundedGalleryCommissionCents = (
  artistPriceCents: number,
  galleryRate: number,
  productionCents: number,
): number => {
  const commission = galleryCommissionCents(artistPriceCents, galleryRate)
  const price = artistPriceCents + commission + productionCents
  return commission + (Math.ceil(price / 100) * 100 - price)
}

/** A percent the admin may save: 0 to 100, whole or with one decimal (27.5 is fine). */
export const isValidGalleryCommissionPct = (pct: unknown): pct is number =>
  typeof pct === 'number' &&
  Number.isFinite(pct) &&
  pct >= GALLERY_COMMISSION_MIN_PCT &&
  pct <= GALLERY_COMMISSION_MAX_PCT &&
  Math.abs(pct * 10 - Math.round(pct * 10)) < 1e-9

/**
 * The share of the ARTWORK price (artist + commission) the gallery keeps, in percent: the
 * Pricing page's "The gallery keeps 20% of the artwork price" at a 25% commission.
 */
export const gallerySharePct = (pct: number): number => (pct <= 0 ? 0 : (pct / (100 + pct)) * 100)
