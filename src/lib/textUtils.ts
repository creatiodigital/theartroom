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
