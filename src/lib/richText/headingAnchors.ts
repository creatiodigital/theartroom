/**
 * The content pages' "On this page" (docs/public-redesign/legal.md): every H2 of the editor's
 * (already sanitized) HTML gets an id from its text, and the page lists them. Pure string work, so
 * the server renders both the anchors and the list, and the same input always gives the same ids.
 */
export type PageHeading = { id: string; text: string }

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
}

const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
      return Number.isFinite(n) ? String.fromCodePoint(n) : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })

/** The text of a piece of HTML: tags dropped, entities read, spaces collapsed (bios, excerpts). */
export const plainTextOf = (inner: string) =>
  decode(inner.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()

const slugOf = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section'

export function withHeadingAnchors(html: string): { html: string; headings: PageHeading[] } {
  const headings: PageHeading[] = []
  const used = new Map<string, number>()

  const anchored = html.replace(
    /<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi,
    (match, attrs: string | undefined, inner: string) => {
      const text = plainTextOf(inner)
      if (!text) return match
      const base = slugOf(text)
      const seen = used.get(base) ?? 0
      used.set(base, seen + 1)
      const id = seen === 0 ? base : `${base}-${seen + 1}`
      headings.push({ id, text })
      const kept = (attrs ?? '').replace(/\s+id\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, '')
      return `<h2${kept} id="${id}">${inner}</h2>`
    },
  )

  return { html: anchored, headings }
}
