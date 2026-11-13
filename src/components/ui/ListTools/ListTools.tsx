'use client'

import { MagnifyingGlass, X } from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'

import styles from './ListTools.module.scss'

/**
 * The public lists' tools (docs/public-redesign/components.md "ListTools", artists.md): shown only
 * above a threshold the page decides. A search field that filters as you type, with a clear button
 * once there is text; and "Showing N of M" with an outline Show more button. No infinite scroll.
 */
export function ListSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  /** Also its accessible name. */
  placeholder: string
}) {
  return (
    <div className={styles.search}>
      <MagnifyingGlass size={19} weight="light" aria-hidden className={styles.searchIcon} />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={styles.input}
      />
      {value && (
        <Button
          variant="bare"
          className={styles.clear}
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <X size={16} weight="light" aria-hidden />
        </Button>
      )}
    </div>
  )
}

export function ShowMore({
  shown,
  total,
  noun,
  onMore,
}: {
  shown: number
  total: number
  /** Plural, e.g. "exhibitions": "Showing 8 of 20 exhibitions", "Show more exhibitions". */
  noun: string
  onMore: () => void
}) {
  return (
    <div className={styles.more}>
      <p className={styles.count}>
        Showing {shown} of {total} {noun}
      </p>
      <Button variant="bare" className={styles.moreButton} onClick={onMore}>
        Show more {noun}
      </Button>
    </div>
  )
}
