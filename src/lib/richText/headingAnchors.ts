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

/** One part of a rich text split at its H2s: the heading's text (null before the first) and the HTML under it. */
export type H2Section = { heading: string | null; html: string }

/**
 * The editor's HTML cut at every H2, for pages that lay each part out as a labelled section
 * (About: the heading becomes the TextSection's label, the rest its text). Blank parts are dropped.
 */
export function splitAtH2(html: string): H2Section[] {
  const sections: H2Section[] = []
  const pattern = /<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>/gi
  let heading: string | null = null
  let from = 0
  const push = (to: number) => {
    const part = html.slice(from, to)
    if (heading !== null || plainTextOf(part)) sections.push({ heading, html: part.trim() })
  }
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    push(match.index)
    heading = plainTextOf(match[1]) || null
    from = match.index + match[0].length
  }
  push(html.length)
  return sections.filter((section) => section.heading !== null || section.html !== '')
}
