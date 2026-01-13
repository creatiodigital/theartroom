'use client'

import c from 'classnames'
import DOMPurify from 'isomorphic-dompurify'

import styles from './RichText.module.scss'

type RichTextProps = {
  content: string
  className?: string
}

// Allowed tags from TipTap rich text editor
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'a',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'code', 'pre',
  'span', 'div',
]

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class']

export const RichText = ({ content, className }: RichTextProps) => {
  if (!content) return null

  // Sanitize HTML to prevent XSS attacks
  const sanitizedContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  })

  return (
    <div className={c(styles.richText, className)} dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
  )
}

