'use client'

import { useMemo, useState } from 'react'

import { ArtworkGrid } from '@/components/artwork/ArtworkGrid'
import { ArrowLink } from '@/components/ui/ArrowLink'
import { EmptyState } from '@/components/ui/EmptyState'
import type { SelectOption } from '@/components/ui/SelectDropdown'
import type { GallerySelectionCard } from '@/lib/queries/getGallerySelection'

import { PrintsToolbar } from './PrintsToolbar'
import styles from './prints.module.scss'
import type { EditionFilter } from './types'

type Props = {
  /** The gallery's selection, already ordered. Small and complete, so every
   *  filter below is a synchronous pass over this array — no server round-trip,
   *  no pagination, no loading state to cover. */
  selection: GallerySelectionCard[]
}

export const PrintsSelection = ({ selection }: Props) => {
  const [artistName, setArtistName] = useState('')
  const [edition, setEdition] = useState<EditionFilter>('')

  // Built from the selection itself, so the dropdown can never offer an artist
  // with nothing on the page. Keyed by display name — the selection carries no
  // user id, and two artists sharing a display name would already be
  // indistinguishable to a buyer reading the grid.
  // By last name (prints.md), then the display name.
  const artistOptions = useMemo<SelectOption<string>[]>(() => {
    const byName = new Map<string, string>()
    for (const card of selection) {
      if (card.artistName && !byName.has(card.artistName))
        byName.set(card.artistName, card.artistLastName || card.artistName)
    }
    const names = [...byName.keys()].sort(
      (a, b) => byName.get(a)!.localeCompare(byName.get(b)!) || a.localeCompare(b),
    )
    return [
      { value: '', label: 'All artists' },
      ...names.map((name) => ({ value: name, label: name })),
    ]
  }, [selection])

  // "See all prints by {artist}" (prints.md): their page, where every print of theirs is.
  const chosenHandler = artistName
    ? selection.find((c) => c.artistName === artistName)?.artistHandler
    : undefined

  const visible = useMemo(
    () =>
      selection.filter(
        (c) =>
          (artistName === '' || c.artistName === artistName) &&
          (edition === '' || c.sale.editionType === edition),
      ),
    [selection, artistName, edition],
  )

  // Every artist in the dropdown has at least one work here, so an empty grid is
  // always a filter combination — never "no prints at all".
  const editionDesc =
    edition === 'limited' ? 'limited-edition' : edition === 'open' ? 'open-edition' : null
  const emptyMessage =
    artistName && editionDesc
      ? `No ${editionDesc} prints by this artist — try another edition type or artist.`
      : editionDesc
        ? `No ${editionDesc} prints in the current selection.`
        : 'No prints match the current filters.'

  return (
    <>
      <PrintsToolbar
        artistOptions={artistOptions}
        artistId={artistName}
        onArtistChange={setArtistName}
        editionId={edition}
        onEditionChange={setEdition}
        count={visible.length}
      />
      {artistName && chosenHandler && (
        <ArrowLink href={`/artists/${chosenHandler}`} className={styles.artistLink}>
          See all prints by {artistName}
        </ArrowLink>
      )}

      <div className={styles.results}>
        {visible.length === 0 ? (
          <EmptyState message={emptyMessage} className={styles.emptyResults} />
        ) : (
          /* `fromPrints` and not the filtered list: the arrows on the artwork
             page walk the whole curated selection, so a work opened from a
             filtered grid still steps through every print rather than dead-
             ending at the edge of a filter the next page knows nothing about. */
          <ArtworkGrid artworks={visible} fromPrints showArtist showEdition />
        )}
      </div>
    </>
  )
}
