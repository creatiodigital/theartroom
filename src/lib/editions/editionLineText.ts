// Client-safe (no database): the artwork page's print block and the wizard's size picker use it.

/**
 * The edition as a row states it (owner, 2026-11-20): "Edition 3 of 30" — the copy a buyer gets,
 * the number the renders pencil — or "Edition of 30" once sold out (the price says Sold out).
 */
export function editionLineText(line: {
  editionSize: number
  soldOut: boolean
  nextCopy: number | null
}): string {
  return line.soldOut
    ? `Edition of ${line.editionSize}`
    : `Edition ${line.nextCopy ?? 1} of ${line.editionSize}`
}
