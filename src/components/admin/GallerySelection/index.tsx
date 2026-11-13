'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowSquareOut, Plus } from '@phosphor-icons/react'

import { AdminBreadcrumb } from '@/components/admin/ui/AdminBreadcrumb'
import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Callout } from '@/components/admin/ui/Callout'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { FeedbackBar } from '@/components/admin/ui/FeedbackBar'
import { ListPanel } from '@/components/admin/ui/ListPanel'
import { SORTABLE_KEYBOARD_HINT } from '@/components/admin/ui/SortableList'
import { Button } from '@/components/ui/Button'
import type {
  AdminHomePrintRow,
  AdminSelectionRow,
  CuratedList,
} from '@/lib/queries/getGallerySelection'

import { AddArtworksModal } from './AddArtworksModal'
import { SelectionList } from './SelectionList'
import styles from './GallerySelection.module.scss'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const workTitle = (row: AdminSelectionRow) => row.artwork.title || row.artwork.name

/**
 * The words and addresses of each curated list. Gallery selection is the whole of /prints; Home
 * page prints (docs/public-redesign/home.md §5, designs/home-prints-admin.dc.html) is its twin
 * with its own list, shown only in the homepage's Fine-art prints section. Same screen, same logic.
 */
const LISTS: Record<
  CuratedList,
  {
    api: string
    title: string
    sub: string
    viewHref: string
    viewLabel: string
    pickerSub: string
    emptyText: string
    removeTitle: string
    removeMessage: (title: string) => string
  }
> = {
  prints: {
    api: '/api/selected-prints',
    title: 'Gallery selection',
    sub: 'The works on the Prints page, in this order. Drag to reorder.',
    viewHref: '/prints',
    viewLabel: 'View Prints page',
    pickerSub: 'Pick the prints to show on the Prints page. Order them once they are in.',
    emptyText: 'The Prints page is showing its empty state.',
    removeTitle: 'Remove from the selection?',
    removeMessage: (title) => `${title} will no longer be on the Prints page.`,
  },
  home: {
    api: '/api/home-prints',
    title: 'Home page prints',
    sub: "The artworks that rotate in the homepage's Fine-art prints section, in this order. Drag to reorder. They only show there, not on the Prints page. Artworks without a print presentation render are skipped until they're rendered.",
    viewHref: '/',
    viewLabel: 'View homepage',
    pickerSub: 'Pick the prints to rotate on the homepage. Order them once they are in.',
    emptyText: "The homepage's Fine-art prints section is hidden.",
    removeTitle: 'Remove from Home page prints?',
    removeMessage: (title) => `${title} will no longer rotate on the homepage.`,
  },
}

type GallerySelectionProps = {
  /** Which curated list this screen edits (default: Gallery selection). */
  list?: CuratedList
}

export const GallerySelection = ({ list = 'prints' }: GallerySelectionProps) => {
  const copy = LISTS[list]
  const [rows, setRows] = useState<(AdminSelectionRow & Partial<AdminHomePrintRow>)[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  // questions.md Q74: failures are said on screen (they were console only): a failed load in red
  // with no list (a refused one read as "Nothing selected yet", a thrown one left the page blank),
  // a refused reorder or remove in a red bar. Remove asks first.
  const [loadError, setLoadError] = useState(false)
  const [actionError, setActionError] = useState('')
  const [removeTarget, setRemoveTarget] = useState<AdminSelectionRow | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(copy.api)
      if (!res.ok) throw new Error(`Selection: ${res.status}`)
      setRows(await res.json())
      setLoadError(false)
    } catch (error) {
      console.error('Error loading the selection:', error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [copy.api])

  useEffect(() => {
    void load()
  }, [load])

  const handleReorder = async (ids: string[]) => {
    // Optimistic: the drag already moved it on screen, and snapping back on a
    // slow round-trip reads as a failed drag.
    setRows((prev) => ids.map((id) => prev.find((r) => r.selectionId === id)!).filter(Boolean))
    try {
      const res = await fetch(`${copy.api}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) {
        console.error('Reorder failed:', res.status)
        setActionError("Couldn't save the new order. Please try again.")
      }
    } catch (error) {
      // A rejected fetch (offline, dropped connection) throws before the line
      // below ever runs — without this catch, the optimistic order would be
      // left on screen with no confirmation it was ever persisted. This
      // screen's whole job is to never lie about what's saved, so `load()`
      // in `finally` always has the last word, success or failure.
      console.error('Error reordering selection:', error)
      setActionError("Couldn't save the new order. Please try again.")
    } finally {
      void load()
    }
  }

  const handleRemove = async (row: AdminSelectionRow) => {
    const failed = `Couldn't remove ${workTitle(row)}. Please try again.`
    setRemoveTarget(null)
    try {
      const res = await fetch(`${copy.api}/${row.selectionId}`, { method: 'DELETE' })
      if (!res.ok) {
        console.error('Remove failed:', res.status)
        setActionError(failed)
      }
    } catch (error) {
      // Same reasoning as handleReorder: a dropped response (the DELETE may
      // have landed server-side even though the client never heard back)
      // must not leave a removed row looking like it's still selected, or
      // vice versa. Reconcile unconditionally.
      console.error('Error removing selection:', error)
      setActionError(failed)
    } finally {
      void load()
    }
  }

  // Stable across renders: the picker's fetch effects list this in their deps,
  // and a fresh array every render would refire them mid-search.
  const excludeIds = useMemo(() => rows.map((r) => r.artwork.id), [rows])

  // Per-artist tally. Surfaced, never enforced: the owner asked for no cap, but
  // "four of these are by one artist" should not need counting by eye.
  const perArtist = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.artistName] = (acc[r.artistName] ?? 0) + 1
    return acc
  }, {})
  // Counted apart: a sold-out entry is a signal worth keeping on the page, a
  // withdrawn one is a gap to fill.
  const soldOutCount = rows.filter((r) => r.status === 'sold-out').length
  const withdrawnCount = rows.filter((r) => r.status === 'not-for-sale').length
  // Home page prints only: a work waiting for its render is skipped on the homepage.
  const unrenderedCount = list === 'home' ? rows.filter((r) => r.rendered === false).length : 0

  const perArtistLine = Object.entries(perArtist)
    .map(([name, n]) => `${name} ${n}`)
    .join(' · ')

  return (
    <div className={styles.screen}>
      {/* gallery.md §2 (Q4): Content / Gallery selection, in place of an eyebrow. */}
      <AdminBreadcrumb
        items={[{ label: 'Content', href: '/admin/content' }, { label: copy.title }]}
      />
      <AdminPageHeader
        title={copy.title}
        description={
          <>
            <span className={styles.sub}>{copy.sub}</span>
            {/* The tally, once loaded (it read "0 works · 0 artists" while loading). */}
            {!loading && (
              <span className={styles.tally}>
                {plural(rows.length, 'work', 'works')} ·{' '}
                {plural(Object.keys(perArtist).length, 'artist', 'artists')}
                {soldOutCount > 0 ? ` · ${soldOutCount} sold out` : ''}
                {withdrawnCount > 0 ? ` · ${withdrawnCount} hidden` : ''}
                {unrenderedCount > 0 ? ` · ${unrenderedCount} without a render` : ''}
              </span>
            )}
            {!loading && perArtistLine && (
              <span className={styles.tallyDetail}>{perArtistLine}</span>
            )}
          </>
        }
        actions={
          <>
            <Link
              href={copy.viewHref}
              target="_blank"
              rel="noopener noreferrer"
              prefetch={false}
              className={styles.view}
            >
              {copy.viewLabel}
              <ArrowSquareOut size={16} weight="light" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </Link>
            {/* The picker leaves out what is already selected: not without the list (Q74). */}
            {!loadError && (
              <Button
                variant="bare"
                font="dashboard"
                className={styles.add}
                onClick={() => setPickerOpen(true)}
              >
                <Plus size={16} weight="light" aria-hidden />
                Add artworks
              </Button>
            )}
          </>
        }
      />

      {/* No ×: a dismissed load error would leave an empty page (as Q75). */}
      {loadError && (
        <Callout tone="red" role="alert">
          The selection could not be loaded.
        </Callout>
      )}
      {actionError && (
        <FeedbackBar tone="error" onDismiss={() => setActionError('')}>
          {actionError}
        </FeedbackBar>
      )}

      {loading || loadError ? null : rows.length === 0 ? (
        <ListPanel label="Works">
          <EmptyState title="Nothing selected yet." text={copy.emptyText} />
        </ListPanel>
      ) : (
        <ListPanel
          label="Works"
          count={plural(rows.length, 'work', 'works')}
          footnote={SORTABLE_KEYBOARD_HINT}
        >
          <SelectionList
            list={list}
            rows={rows}
            onReorder={handleReorder}
            onRemove={(selectionId) =>
              setRemoveTarget(rows.find((r) => r.selectionId === selectionId) ?? null)
            }
          />
        </ListPanel>
      )}

      {pickerOpen && (
        <AddArtworksModal
          endpoint={copy.api}
          sub={copy.pickerSub}
          excludeIds={excludeIds}
          onClose={() => setPickerOpen(false)}
          onAdded={load}
        />
      )}

      {removeTarget && (
        <AdminConfirmModal
          title={copy.removeTitle}
          message={copy.removeMessage(workTitle(removeTarget))}
          confirmLabel="Remove"
          destructive
          onConfirm={() => handleRemove(removeTarget)}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  )
}
