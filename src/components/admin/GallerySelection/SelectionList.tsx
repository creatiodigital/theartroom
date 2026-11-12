'use client'

import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

import { SortableList } from '@/components/admin/ui/SortableList'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import type {
  AdminHomePrintRow,
  AdminSelectionRow,
  CuratedList,
  SelectionStatus,
} from '@/lib/queries/getGallerySelection'

import styles from './GallerySelection.module.scss'

/**
 * What the curator is told about each entry. Sold out is NOT a problem state — it
 * stays on the page as proof the editions move — so it reads differently from a
 * work withdrawn from sale entirely.
 */
const REASON: Record<SelectionStatus, string | null> = {
  live: null,
  'sold-out': 'Sold out · shown on the page',
  'not-for-sale': 'Not for sale · hidden from the page',
}

/**
 * Home page prints: the homepage's caption says "available as a signed print", so a sold-out
 * edition is hidden there too (questions.md Q-P22).
 */
const HOME_REASON: Record<SelectionStatus, string | null> = {
  live: null,
  'sold-out': 'Sold out · hidden from the homepage',
  'not-for-sale': 'Not for sale · hidden from the homepage',
}

type Props = {
  /** Which list the rows belong to (default: Gallery selection). */
  list?: CuratedList
  rows: (AdminSelectionRow & Partial<AdminHomePrintRow>)[]
  onReorder: (ids: string[]) => void
  onRemove: (selectionId: string) => void
}

export const SelectionList = ({ list = 'prints', rows, onReorder, onRemove }: Props) => {
  const home = list === 'home'
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = rows.findIndex((r) => r.selectionId === active.id)
    const newIndex = rows.findIndex((r) => r.selectionId === over.id)
    onReorder(arrayMove(rows, oldIndex, newIndex).map((r) => r.selectionId))
  }

  return (
    <SortableList
      onDragEnd={handleDragEnd}
      rows={rows.map((row) => {
        const reason = (home ? HOME_REASON : REASON)[row.status]
        const hidden = row.status === 'not-for-sale' || (home && row.status === 'sold-out')
        return {
          id: row.selectionId,
          title: row.artwork.title || row.artwork.name,
          // e2e hook (gallery-selection-admin.spec.ts).
          marker: 'data-selection-row',
          // Only the thumbnail dims: dimmed text fell under 4.5:1 (questions.md Q71).
          className: hidden ? styles.rowHidden : undefined,
          thumb: row.artwork.imageUrl ? (
            <img src={row.artwork.imageUrl} alt="" className={styles.thumb} />
          ) : (
            <span className={styles.thumb} />
          ),
          sub: (
            <>
              {/* Home page prints: "artist · year", as drawn (home-prints-admin). */}
              <span>
                {row.artistName}
                {home
                  ? row.artwork.year
                    ? ` · ${row.artwork.year}`
                    : ''
                  : row.artwork.sale
                    ? ` · ${row.artwork.sale.editionType === 'limited' ? 'Limited' : 'Open'}`
                    : ''}
              </span>
              {reason && (
                <span
                  className={hidden ? `${styles.reason} ${styles.reasonHidden}` : styles.reason}
                >
                  {reason}
                </span>
              )}
            </>
          ),
          actions: (
            <>
              {home && (
                <StatusPill
                  shape="tag"
                  tone={row.rendered ? 'green' : 'amber'}
                  label={row.rendered ? 'Render ready' : 'No render yet'}
                />
              )}
              <Button
                variant="bare"
                font="dashboard"
                className={styles.remove}
                label="Remove"
                onClick={() => onRemove(row.selectionId)}
              />
            </>
          ),
        }
      })}
    />
  )
}
