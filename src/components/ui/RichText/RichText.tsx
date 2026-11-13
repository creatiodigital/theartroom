import c from 'classnames'
import sanitizeHtml from 'sanitize-html'

import { withHeadingAnchors } from '@/lib/richText/headingAnchors'

import styles from './RichText.module.scss'

type RichTextProps = {
  content: string
  className?: string
  /**
   * Predefined style variants:
   * - 'default': Large serif text for editorial content (biographies, descriptions)
   * - 'compact': Smaller sans-serif text for artwork metadata (technique, dimensions)
   * - 'page': Long-form static pages (About, legal) — more air above section headings
   */
  variant?: 'default' | 'compact' | 'page'
  /**
   * Content pages (docs/public-redesign/legal.md): each H2 gets an id from its text, for the page's
   * "On this page" list (built from the same HTML by `sanitizeRichText` + `withHeadingAnchors`).
   */
  anchorHeadings?: boolean
}

// Server-safe sanitizer. `sanitize-html` is pure JS (no jsdom), unlike the
// previous `isomorphic-dompurify`, whose jsdom dependency threw at Vercel's
// serverless runtime and 500'd any server-rendered CMS page — which is why
// those pages had to stay static. This mirrors the old DOMPurify allowlist 1:1
// so nothing renders differently. DOMPurify's ALLOWED_ATTR was global, so all
// four attributes map to '*'.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'a',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'code',
    'pre',
    'span',
    'div',
  ],
  allowedAttributes: { '*': ['href', 'target', 'rel', 'class'] },
  // Only safe link schemes — blocks javascript:/data: hrefs.
  allowedSchemes: ['http', 'https', 'mailto'],
  // Drop unknown/disallowed tags entirely (matches DOMPurify's behavior).
  disallowedTagsMode: 'discard',
}

/** The HTML RichText renders, sanitized (XSS): for a page that reads it too (its H2 list). */
export const sanitizeRichText = (content: string) => sanitizeHtml(content, SANITIZE_OPTIONS)

export const RichText = ({
  content,
  className,
  variant = 'default',
  anchorHeadings = false,
}: RichTextProps) => {
  if (!content) return null

  // Sanitize HTML to prevent XSS attacks; the anchors are added to the sanitized HTML (ids only).
  const sanitized = sanitizeRichText(content)
  const sanitizedContent = anchorHeadings ? withHeadingAnchors(sanitized).html : sanitized

  return (
    <div
      className={c(
        styles.richText,
        variant === 'compact' && styles.compact,
        variant === 'page' && styles.page,
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  )
}
