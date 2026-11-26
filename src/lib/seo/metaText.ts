import { plainParagraphsOf } from '@/lib/richText/headingAnchors'

/** About what a search result shows before it cuts the line. */
const MAX_LENGTH = 155

/**
 * A meta description from an editor's rich text (a biography, an artwork's note), AR-193: the HTML
 * read as plain text (tags dropped, `&nbsp;` read, paragraphs joined), then cut at a word near
 * 155 characters. Empty when the HTML holds no words (the editor's leftover `<p></p>`), so the
 * caller's own sentence takes over. Before this, the HTML went out as it was: results and share
 * cards read "<p>Matera, Italy</p>".
 */
export function metaTextOf(html: string | null | undefined, max = MAX_LENGTH): string {
  if (!html) return ''
  const text = plainParagraphsOf(html).join(' ')
  return clip(text, max)
}

/** Plain text cut at a word, with an ellipsis, when longer than `max`. */
export function clip(text: string, max = MAX_LENGTH): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const atWord = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${atWord.replace(/[\s,.;:–—-]+$/, '')}…`
}
