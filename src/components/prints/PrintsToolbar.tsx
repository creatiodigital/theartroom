'use client'

import { useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Select, type SelectOption } from '@/components/ui/Select'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import styles from './prints.module.scss'
import type { SortValue } from './types'

const SORT_OPTIONS: SelectOption<SortValue>[] = [
  { value: 'date-desc', label: 'Date (New to Old)' },
  { value: 'date-asc', label: 'Date (Old to New)' },
]

type Props = {
  artistOptions: SelectOption<string>[]
  artistId: string
  onArtistChange: (value: string) => void
  sort: SortValue
  onSortChange: (value: SortValue) => void
  search: string
  onSearchChange: (value: string) => void
}

export const PrintsToolbar = ({
  artistOptions,
  artistId,
  onArtistChange,
  sort,
  onSortChange,
  search,
  onSearchChange,
}: Props) => {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className={styles.filterBar}>
      <div className={styles.filters}>
        <div className={styles.filter}>
          <label className={styles.filterLabel}>Artist</label>
          <Select
            options={artistOptions}
            value={artistId}
            onChange={onArtistChange}
            size="medium"
          />
        </div>
        <div className={styles.filter}>
          <label className={styles.filterLabel}>Sort by</label>
          <Select options={SORT_OPTIONS} value={sort} onChange={onSortChange} size="medium" />
        </div>
      </div>

      <div className={styles.searchArea}>
        {searchOpen ? (
          <input
            autoFocus
            type="search"
            className={styles.searchInput}
            placeholder="Search artist or title"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onBlur={() => {
              if (!search) setSearchOpen(false)
            }}
          />
        ) : (
          <Button
            variant="ghost"
            onClick={() => setSearchOpen(true)}
            className={styles.searchToggle}
            aria-label="Open search"
          >
            <SearchIcon size={18} strokeWidth={ICON_STROKE_WIDTH} />
            <span>Search</span>
          </Button>
        )}
      </div>
    </div>
  )
}
