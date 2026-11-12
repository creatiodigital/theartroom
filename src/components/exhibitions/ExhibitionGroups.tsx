'use client'

import { useState } from 'react'

import { ExhibitionRow, type ExhibitionRowData } from '@/components/exhibitions/ExhibitionRow'
import { ListSearch, ShowMore } from '@/components/ui/ListTools'

import styles from './exhibitions.module.scss'

export type ListedExhibition = ExhibitionRowData & { status: string }

// docs/public-redesign/exhibitions.md "Tools appear only when they help".
const SEARCH_FROM = 9
const PAGED_FROM = 13
const PAGE_SIZE = 8

type GroupKey = 'current' | 'past'

/**
 * Current, then Past (only once an exhibition has closed); newest first in each (the page's
 * order). Search from 9 exhibitions (title or artist), 8 per group with Show more from 13.
 */
export function ExhibitionGroups({ exhibitions }: { exhibitions: ListedExhibition[] }) {
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState<Record<GroupKey, number>>({
    current: PAGE_SIZE,
    past: PAGE_SIZE,
  })

  const total = exhibitions.length
  const searchable = total >= SEARCH_FROM
  const paged = total >= PAGED_FROM
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? exhibitions.filter(
        (e) =>
          e.title.toLowerCase().includes(needle) || e.artistName.toLowerCase().includes(needle),
      )
    : exhibitions

  const groups: { key: GroupKey; label: string; items: ListedExhibition[] }[] = [
    { key: 'current', label: 'Current', items: matches.filter((e) => e.status === 'current') },
    { key: 'past', label: 'Past', items: matches.filter((e) => e.status === 'past') },
  ]

  return (
    <div className={styles.groups}>
      {searchable && (
        <ListSearch
          value={query}
          onChange={setQuery}
          placeholder="Search by exhibition or artist"
        />
      )}
      {needle && matches.length === 0 && (
        <p className={styles.empty}>No exhibition matches “{query.trim()}”.</p>
      )}
      {groups.map(({ key, label, items }) => {
        // Current is always there (today's empty line when it has none); Past only with rows.
        if (key === 'past' && items.length === 0) return null
        if (needle && items.length === 0) return null
        const visible = paged ? items.slice(0, shown[key]) : items
        return (
          <section key={key} className={styles.group} aria-labelledby={`group-${key}`}>
            <h2 id={`group-${key}`} className={styles.groupHeading}>
              {label} <span className={styles.groupCount}>{items.length}</span>
            </h2>
            {items.length === 0 ? (
              <p className={styles.empty}>No current exhibitions.</p>
            ) : (
              <ul className={styles.list}>
                {visible.map((exhibition, index) => (
                  <ExhibitionRow
                    key={exhibition.id}
                    exhibition={exhibition}
                    priority={key === 'current' && index === 0}
                  />
                ))}
              </ul>
            )}
            {paged && items.length > visible.length && (
              <ShowMore
                shown={visible.length}
                total={items.length}
                noun="exhibitions"
                onMore={() => setShown((prev) => ({ ...prev, [key]: prev[key] + PAGE_SIZE }))}
              />
            )}
          </section>
        )
      })}
    </div>
  )
}
