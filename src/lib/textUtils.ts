/**
 * Utility functions for text and content handling
 */

/**
 * Check if rich text content is effectively empty
 * Handles cases like "<p></p>", "<p><br></p>", whitespace, etc.
 */
export const isRichTextEmpty = (content: string | null | undefined): boolean => {
  if (!content) return true

  // Strip HTML tags and check if anything remains
  const textContent = content
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .trim()

  return textContent.length === 0
}

/**
 * Under this many characters a text may sit in two columns: both fit on one screen, so the reader
 * never scrolls back up for the second (docs/public-redesign/readable-text.md rule 3).
 */
export const SHORT_TEXT_MAX_CHARS = 1500

/**
 * The visible length of rich text: tags dropped, an entity counted as one character, any run of
 * whitespace as one space.
 */
export const richTextLength = (content: string | null | undefined): number => {
  if (!content) return 0

  return content
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi, 'x')
    .replace(/\s+/g, ' ')
    .trim().length
}

/** A text short enough for two columns (see SHORT_TEXT_MAX_CHARS). */
export const isShortRichText = (content: string | null | undefined): boolean =>
  richTextLength(content) < SHORT_TEXT_MAX_CHARS
