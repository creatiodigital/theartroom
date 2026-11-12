'use client'

import { useState } from 'react'

import { ArtistRow, type ArtistRowData } from '@/components/artists/ArtistRow'
import { ListSearch, ShowMore } from '@/components/ui/ListTools'

import styles from './artists.module.scss'

// docs/public-redesign/artists.md "Tools appear only when they help".
export const ARTISTS_SEARCH_FROM = 9
const PAGED_FROM = 13
const PAGE_SIZE = 12

/** The artist rows, with search from 9 artists and 12 at a time (Show more) from 13. */
export function ArtistsList({ artists }: { artists: ArtistRowData[] }) {
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)

  const needle = query.trim().toLowerCase()
  const matches = needle ? artists.filter((a) => a.name.toLowerCase().includes(needle)) : artists
  const paged = artists.length >= PAGED_FROM
  const visible = paged ? matches.slice(0, shown) : matches

  return (
    <div className={styles.listArea}>
      {artists.length >= ARTISTS_SEARCH_FROM && (
        <ListSearch value={query} onChange={setQuery} placeholder="Search by artist name" />
      )}
      {needle && matches.length === 0 ? (
        <p className={styles.empty}>No artist matches “{query.trim()}”.</p>
      ) : (
        <ul className={styles.list}>
          {visible.map((artist) => (
            <li key={artist.href}>
              <ArtistRow artist={artist} />
            </li>
          ))}
        </ul>
      )}
      {paged && matches.length > visible.length && (
        <ShowMore
          shown={visible.length}
          total={matches.length}
          noun="artists"
          onMore={() => setShown((n) => n + PAGE_SIZE)}
        />
      )}
    </div>
  )
}
