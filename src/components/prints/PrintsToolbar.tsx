'use client'

import c from 'classnames'

import { Button } from '@/components/ui/Button'
import { SelectDropdown, type SelectOption } from '@/components/ui/SelectDropdown'

import styles from './prints.module.scss'
import type { EditionFilter } from './types'

type Props = {
  artistOptions: SelectOption<string>[]
  artistId: string
  onArtistChange: (value: string) => void
  editionId: EditionFilter
  onEditionChange: (value: EditionFilter) => void
  /** Works shown after the filters. */
  count: number
}

const EDITIONS: { value: EditionFilter; label: string }[] = [
  { value: '', label: 'All editions' },
  { value: 'limited', label: 'Limited' },
  { value: 'open', label: 'Open' },
]

/**
 * docs/public-redesign/prints.md "Filters": the Artist menu, the Editions switch (same filtering
 * as before) and the count on the right; stacked full width on phones, the count below.
 */
export const PrintsToolbar = ({
  artistOptions,
  artistId,
  onArtistChange,
  editionId,
  onEditionChange,
  count,
}: Props) => (
  <div className={styles.filters}>
    <div className={styles.filterControls}>
      <SelectDropdown
        options={artistOptions}
        value={artistId}
        onChange={onArtistChange}
        variant="field"
        inlineLabel="Artist"
        className={styles.artistMenu}
      />
      <div role="group" aria-label="Editions" className={styles.editionSwitch}>
        {EDITIONS.map((edition) => (
          <Button
            key={edition.value || 'all'}
            variant="bare"
            aria-pressed={editionId === edition.value}
            className={c(styles.segment, editionId === edition.value && styles.segmentOn)}
            onClick={() => onEditionChange(edition.value)}
          >
            {edition.label}
          </Button>
        ))}
      </div>
    </div>
    {/* Not shown (owner, 2026-11-12: no counts); still read out when a filter changes it. */}
    <p className="sr-only" aria-live="polite">
      {count === 1 ? '1 selected print' : `${count} selected prints`}
    </p>
  </div>
)
