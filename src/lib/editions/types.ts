/**
 * Shared client-facing shapes for limited editions, used by the dashboard
 * variant editor and the buyer wizard. The server-authoritative types live
 * with their validators (`validateVariant.ts`, Prisma models).
 */

/** A variant as edited in the dashboard. `id` is absent for a not-yet-saved
 *  row; numbers are kept as-is (the form coerces strings before sending). */
export type LimitedVariantDraft = {
  id?: string
  name: string
  paperId: string
  widthCm: number
  heightCm: number
  borderCm: number
  /** Fixed-sheet mode: total sheet size in cm. Both null/absent = adaptive
   *  mode, where the sheet is image + 2*borderCm. When set, `borderCm` is a
   *  MINIMUM and the real per-axis borders come from computeSheetLayout. */
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
  editionSize: number
  /** Artist's cut for this variant, as the artist types it in euros. The
   *  server converts to cents. Derived from `priceCents` on load. */
  priceEuros?: string
  /** Stored cents from the DB on load (read-only here; the editor edits
   *  `priceEuros`, which is the source of truth on save). */
  priceCents?: number | null
  /** True once published (edition numbers materialised). */
  published?: boolean
  /** Per-variant lock. Only meaningful when published: true = frozen + on
   *  sale; false = an admin unblocked it (editable + paused from sale). */
  blocked?: boolean
  /** Copies of this variant already reserved or sold, from the GET. Separate
   *  from `blocked` on purpose: an UNBLOCKED variant shows no "Currently
   *  Selling" badge but may still own real orders, so this — not the lock —
   *  is what decides whether deleting is even offered. */
  committedCount?: number
  /** Copies a BUYER actually took: bound to an order at authorisation, or
   *  confirmed sold at capture. Excludes numbers merely claimed by a
   *  PaymentIntent — opening checkout and walking away is not a sale, and
   *  counting it as one is what made a variant with no orders read "5 sold".
   *  This is the number the badge shows; `committedCount` still gates Delete. */
  soldCount?: number
}

/** A published variant as shown to the buyer, with live stock. */
export type LimitedVariantView = {
  id: string
  name: string
  paperId: string
  printTypeId: string
  widthCm: number
  heightCm: number
  borderCm: number
  /** Fixed-sheet mode: total sheet size in cm. Both null/absent = adaptive
   *  mode, where the sheet is image + 2*borderCm. When set, `borderCm` is a
   *  MINIMUM and the real per-axis borders come from computeSheetLayout. */
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
  editionSize: number
  /** Artist's cut for this variant, in cents. */
  priceCents: number | null
  /** Count of edition numbers still available to buy. 0 = sold out. Decides what can be SELECTED
   *  (a number held by an unfinished checkout can't be sold twice). */
  remaining: number
  /** Copies not yet sold: edition size − sold copies. The "N left" the visitor reads, the same
   *  count as the artwork page (owner, 2026-11-17: "one count everywhere"); a reservation never
   *  moves it. */
  left: number
  /** The copy a buyer gets: the lowest not yet paid for — "Edition 3 of 30", the same number as
   *  the artwork page and the renders (owner, 2026-11-20). Null when sold out. */
  nextCopy: number | null
}
