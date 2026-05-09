import c from 'classnames'
import DOMPurify from 'isomorphic-dompurify'

import styles from './RichText.module.scss'

type RichTextProps = {
  content: string
  className?: string
  /**
   * Predefined style variants:
   * - 'default': Large serif text for editorial content (biographies, descriptions)
   * - 'compact': Smaller sans-serif text for artwork metadata (technique, dimensions)
   */
  variant?: 'default' | 'compact'
}

// Allowed tags from TipTap rich text editor
const ALLOWED_TAGS = [
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
]

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class']

export const RichText = ({ content, className, variant = 'default' }: RichTextProps) => {
  if (!content) return null

  // Sanitize HTML to prevent XSS attacks
  const sanitizedContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  })

  return (
    <div
      className={c(styles.richText, variant === 'compact' && styles.compact, className)}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  )
}
