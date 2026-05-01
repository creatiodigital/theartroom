/**
 * Strip ASCII control characters (newlines, tabs, NUL, etc.) and zero-
 * width / direction-override Unicode from a single-line text field, then
 * collapse double whitespace and trim. Defense in depth against:
 *   - Email header injection (CRLF in a value that flows to a header)
 *   - Invisible-character spoofing of names / addresses
 *   - Multi-line dumps pasted into single-line inputs
 *
 * Apply at every server endpoint that accepts plain-text user input,
 * BEFORE length checks (so a tampered payload padded with control
 * chars can't sneak past via raw byte count). Idempotent — safe to
 * call multiple times.
 *
 * Do NOT use on:
 *   - Rich-text HTML (use DOMPurify instead)
 *   - Multi-line plain-text fields (newlines are legitimate; use
 *     `sanitizeMultiline` instead)
 *   - JSON config blobs (have their own shape validators)
 */
export function sanitizeLine(value: string): string {
  return value
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Same idea as `sanitizeLine` but preserves newlines (so multi-line
 * messages — inquiries, refund reasons, manual-payment notes — keep
 * their structure). Strips every other control character + zero-width
 * Unicode. Newlines themselves are normalised to `\n` and runs of more
 * than two consecutive newlines are collapsed (no infinite blank
 * lines).
 */
export function sanitizeMultiline(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, ' ')
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
