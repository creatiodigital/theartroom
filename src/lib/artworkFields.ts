import type { Prisma } from '@/generated/prisma'

/**
 * Master-original fields that must NEVER appear on a public artwork read.
 * `originalImageUrl` points at the 60MB+ print master on the public R2 bucket
 * (key secrecy is its only protection); the sibling metadata columns are print
 * internals. Single source of truth so a future sensitive column is stripped
 * everywhere by editing one place. Fulfillment reads the master server-side and
 * does not go through these public endpoints.
 */
export const PUBLIC_ARTWORK_OMIT = {
  originalImageUrl: true,
  originalSizeBytes: true,
  originalDpi: true,
  originalFormat: true,
} satisfies Prisma.ArtworkOmit

/**
 * A unique piece's private prices (docs/unique-sales U1): the artist's suggested price (artist and
 * gallery only), the lowest the gallery accepts (admin only) and the artist's own sale price when
 * sold elsewhere. The public never sees any of them; the artist never sees the lowest.
 *
 * The Prisma client leaves them out of EVERY query (src/lib/prisma.ts), so no page or API returns
 * them by accident, whatever it selects or spreads. A query that needs one names it
 * (`omit: { suggestedPriceCents: false }` or a `select`), and only the editor's own routes may.
 */
export const PRIVATE_ARTWORK_OMIT = {
  suggestedPriceCents: true,
  lowestPriceCents: true,
  soldElsewherePriceCents: true,
} satisfies Prisma.ArtworkOmit
