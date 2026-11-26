/**
 * An announcement's optional button (docs/take-a-peek/README.md T9): the link the admin types,
 * checked the same way in the editor and in the API.
 *
 * Accepted: an `https://` address, a site path (`/prints`), or `mailto:` (opens the visitor's email
 * app). Anything else (http://, javascript:, a bare word, a protocol-relative `//host`) is refused.
 */

/** The editor's line under the field, and the API's refusal. */
export const BUTTON_LINK_HELP =
  'Optional. A web address, or mailto: to open the visitor’s email app.'
export const BUTTON_LINK_ERROR =
  'Use a web address starting with https://, a site path such as /prints, or mailto:.'

/** Long enough for a mailto: with a prefilled subject and body. */
export const BUTTON_LINK_MAX = 2000
export const BUTTON_LABEL_MAX = 60

export const isMailto = (link: string) => /^mailto:/i.test(link)

/** The link trimmed, `null` when empty, or `false` when it is not one of the accepted kinds. */
export const normalizeButtonLink = (raw: string): string | null | false => {
  const link = raw.trim()
  if (!link) return null
  if (link.length > BUTTON_LINK_MAX) return false
  if (isMailto(link)) return link.length > 'mailto:'.length ? link : false
  if (link.startsWith('/') && !link.startsWith('//')) return link
  try {
    const url = new URL(link)
    return url.protocol === 'https:' && url.hostname ? link : false
  } catch {
    return false
  }
}
