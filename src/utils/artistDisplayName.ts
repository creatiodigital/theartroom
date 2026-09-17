/**
 * The artist's name as a reader sees it, and the rule for prefilling an
 * artwork's Author field with it.
 *
 * `[name, lastName].filter(Boolean).join(' ')` was being retyped at a dozen call
 * sites (orders, analytics, certificates) in two slightly different spellings —
 * one of which produces a stray space when `lastName` is empty. New code uses
 * this; the existing call sites were deliberately left alone rather than swept
 * up in an unrelated change.
 */

/** Anything that carries an artist's two name halves — a User row, or a select of one. */
export type ArtistNameSource = { name?: string | null; lastName?: string | null } | null | undefined

/** "John Doe". Empty string — never `undefined` — when there is no artist to name. */
export const artistDisplayName = (user: ArtistNameSource): string =>
  [user?.name, user?.lastName].filter(Boolean).join(' ').trim()

/**
 * What the Author field shows.
 *
 * Almost every artwork is by the artist who owns it, so an empty Author is
 * filled with their name; an author that someone actually typed is returned
 * untouched, because the exceptions (an estate, a collaboration, a pseudonym)
 * are the whole reason the field is free text.
 *
 * `user` must be the ARTWORK's artist, not the signed-in one — admins edit other
 * artists' work, and stamping the admin's name on someone else's piece would be
 * wrong in a way nobody would notice until it reached a certificate.
 */
export const resolveArtworkAuthor = (
  author: string | null | undefined,
  user: ArtistNameSource,
): string => (author && author.trim() ? author : artistDisplayName(user))
