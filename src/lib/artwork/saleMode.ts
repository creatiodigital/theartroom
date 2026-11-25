/**
 * How an artwork is sold (docs/unique-sales/README.md, owner 2026-11-25: "one artwork = one way of
 * selling"): prints (image works only: the print pipeline), a unique piece (an original sold by
 * inquiry: image works and Objects), or not for sale (Inquire only). Never two at once.
 */
export const SALE_MODES = ['prints', 'unique', 'none'] as const
export type TSaleMode = (typeof SALE_MODES)[number]

export const isSaleMode = (value: unknown): value is TSaleMode =>
  typeof value === 'string' && (SALE_MODES as readonly string[]).includes(value)

/** A unique piece's availability (`Artwork.originalStatus`). */
export const ORIGINAL_STATUSES = ['available', 'reserved', 'sold'] as const
export type TOriginalStatus = (typeof ORIGINAL_STATUSES)[number]

/**
 * The sale mode after a save that sets the print switch, until the editor's Sales tab (U3) writes
 * the mode itself: print sales on means "prints"; off turns "prints" into "none"; a unique piece
 * is left as it is. Keeps `printEnabled` and `saleMode` in step, so the print pipeline (which
 * reads `printEnabled`) is untouched.
 */
export function saleModeAfterPrintSwitch(current: string, printEnabled: boolean): TSaleMode {
  if (printEnabled) return 'prints'
  if (current === 'prints' || !isSaleMode(current)) return 'none'
  return current
}
