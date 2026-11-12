/**
 * "Find your country" in the Where we ship window (docs/public-redesign/order-flow.md): ignores case
 * and accents and matches the start of any word, so "king" finds United Kingdom and "cote" finds
 * Côte d'Ivoire. An empty query matches everything.
 */
export function countryMatches(name: string, query: string): boolean {
  const q = words(query)
  if (q === '') return true
  return ` ${words(name)}`.includes(` ${q}`)
}

/** Lower case, accents removed, every run of non-letters / non-digits one space. */
function words(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}
