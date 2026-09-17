/**
 * The Artwork Library's type filter, remembered across visits.
 *
 * Editing a work navigates away from the library and back, remounting it — so a
 * filter held only in component state resets to "All" after every save. Working
 * through a batch of images that means re-selecting Image each time.
 *
 * Storage is per browser, not per account: this is a view preference, the same
 * kind of thing `CollapsibleSection` remembers, and nothing here is private.
 */

export const ARTWORK_TYPE_FILTERS = ['all', 'image', 'text', 'sound', 'video'] as const

export type ArtworkTypeFilter = (typeof ARTWORK_TYPE_FILTERS)[number]

const STORAGE_KEY = 'artwork-type-filter'

/**
 * Whatever came out of storage, narrowed to a filter this build understands.
 *
 * Anything unrecognised becomes 'all' rather than being trusted: a filter
 * removed in a later release — or an entry edited by hand — would otherwise
 * leave the library showing nothing at all, which reads as lost artworks rather
 * than as a stale preference.
 */
export const parseArtworkTypeFilter = (raw: string | null): ArtworkTypeFilter =>
  ARTWORK_TYPE_FILTERS.includes(raw as ArtworkTypeFilter) ? (raw as ArtworkTypeFilter) : 'all'

/** Reading localStorage throws in some privacy modes, and is unavailable during
 *  SSR — either way the library still renders, just unremembered. */
export const readArtworkTypeFilter = (): ArtworkTypeFilter => {
  if (typeof window === 'undefined') return 'all'
  try {
    return parseArtworkTypeFilter(localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'all'
  }
}

export const writeArtworkTypeFilter = (value: ArtworkTypeFilter): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* storage unavailable — the filter simply will not be remembered */
  }
}
