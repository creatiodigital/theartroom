'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { CaretLeft, CaretRight, Check, ImageBroken } from '@phosphor-icons/react'

import { getPrintArtistOptions, getPrintsCatalogPage } from '@/app/prints/actions'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ButtonGroup } from '@/components/ui/ButtonGroup'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
import {
  PRINTS_PAGE_SIZE,
  type PrintArtistOption,
  type PrintArtwork,
} from '@/components/prints/types'

import styles from './GallerySelection.module.scss'

type Mode = 'artist' | 'name'

type Props = {
  /** The list's API: '/api/selected-prints' (Gallery selection) or '/api/home-prints'. */
  endpoint: string
  /** The line under "Add artworks": what the picked prints are for. */
  sub: string
  /** Already selected — never offered again. */
  excludeIds: string[]
  onClose: () => void
  onAdded: () => void
}

const SKELETON_COUNT = 10

type CatalogQuery = Omit<Parameters<typeof getPrintsCatalogPage>[0], 'page'>

/**
 * Every matching print, not one page of them. The picker borrows the public
 * catalog's paged query, which stops at PRINTS_PAGE_SIZE — asking for page 1
 * alone silently dropped an artist's oldest work once they had more than one
 * page. Page 1 reports the total; the rest are fetched from it. The server
 * query keeps its page cap, so nothing public can ask for an unbounded list.
 */
const fetchAllPrints = async (query: CatalogQuery): Promise<PrintArtwork[]> => {
  const first = await getPrintsCatalogPage({ ...query, page: 1 })
  const pageCount = Math.ceil(first.totalCount / PRINTS_PAGE_SIZE)
  const rest = await Promise.all(
    Array.from({ length: Math.max(pageCount - 1, 0) }, (_, i) =>
      getPrintsCatalogPage({ ...query, page: i + 2 }),
    ),
  )
  return [first, ...rest].flatMap((r) => r.items)
}

/**
 * Two ways in, never both at once, because they answer different questions:
 * "what does Jane have?" and "where is that piece called Puerta?".
 *
 * The searches are deliberately not uniform. The artist list scales with
 * artists, and one artist's output is bounded — both are fetched once and
 * filtered in the browser, so typing is instant. Searching titles across every
 * artist is unbounded, so that one goes to the server.
 */
export const AddArtworksModal = ({ endpoint, sub, excludeIds, onClose, onAdded }: Props) => {
  const [mode, setMode] = useState<Mode>('artist')
  const [query, setQuery] = useState('')
  const [artists, setArtists] = useState<PrintArtistOption[]>([])
  const [artistId, setArtistId] = useState<string | null>(null)
  const [artistWorks, setArtistWorks] = useState<PrintArtwork[]>([])
  const [nameResults, setNameResults] = useState<PrintArtwork[]>([])
  const [loadingWorks, setLoadingWorks] = useState(false)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    void getPrintArtistOptions().then(setArtists)
  }, [])

  // Drill-in: one artist's sellable prints, fetched once and filtered locally.
  // Clear the previous artist's rows first — otherwise, for the instant before
  // the fetch resolves, the list still shows the PRIOR artist's prints under
  // the new artist's header, and a fast click could tick the wrong work.
  useEffect(() => {
    if (!artistId) return
    setQuery('')
    setArtistWorks([])
    setLoadingWorks(true)
    // A slower answer for the artist clicked BEFORE must not land after this
    // one's and fill the list with their prints.
    let stale = false
    void fetchAllPrints({ artistId, excludeIds })
      .then((works) => {
        if (!stale) setArtistWorks(works)
      })
      .finally(() => {
        if (!stale) setLoadingWorks(false)
      })
    return () => {
      stale = true
    }
  }, [artistId, excludeIds])

  // Title search across everyone — the only unbounded case, so debounced.
  useEffect(() => {
    if (mode !== 'name') return
    if (query.trim() === '') {
      setNameResults([])
      setLoadingWorks(false)
      return
    }
    setLoadingWorks(true)
    let stale = false
    const t = setTimeout(() => {
      void fetchAllPrints({ search: query.trim(), excludeIds })
        .then((results) => {
          if (!stale) setNameResults(results)
        })
        .finally(() => {
          if (!stale) setLoadingWorks(false)
        })
    }, 250)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [mode, query, excludeIds])

  const visibleArtists = useMemo(
    () => artists.filter((a) => a.label.toLowerCase().includes(query.trim().toLowerCase())),
    [artists, query],
  )
  const visibleArtistWorks = useMemo(
    () =>
      artistWorks.filter((w) =>
        (w.title || w.name || '').toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [artistWorks, query],
  )
  const currentArtist = artists.find((a) => a.value === artistId) ?? null

  const toggle = useCallback((id: string) => {
    setTicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleAdd = async () => {
    setSaving(true)
    setAddError('')
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkIds: [...ticked] }),
      })
      if (res.ok) {
        onAdded()
        onClose()
      } else {
        // Stays open on failure — most likely a work sold out or was selected
        // elsewhere while this modal sat open — so the curator can drop it and
        // retry rather than lose the rest of an otherwise-good batch. Said in
        // the footer (questions.md Q74), with the server's reason when it gives one.
        console.error('Add artworks failed:', res.status)
        const data = await res.json().catch(() => null)
        setAddError(data?.error || "Couldn't add these works. Please try again.")
      }
    } catch (error) {
      // A thrown request left "Adding…" on for good.
      console.error('Error adding artworks:', error)
      setAddError("Couldn't add these works. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const card = (w: PrintArtwork) => {
    const on = ticked.has(w.id)
    const title = w.title || w.name
    return (
      <div key={w.id} data-picker-row className={styles.pickerCell}>
        <Button
          font="dashboard"
          variant="bare"
          role="checkbox"
          aria-checked={on}
          title={title}
          className={on ? `${styles.pickerCard} ${styles.pickerCardOn}` : styles.pickerCard}
          onClick={() => toggle(w.id)}
        >
          <span className={styles.pickerThumb}>
            {/* imageUrl only — never originalImageUrl, the 60MB+ print master. */}
            {w.imageUrl ? (
              <img src={w.imageUrl} alt="" className={styles.pickerThumbImg} />
            ) : (
              <ImageBroken
                size={20}
                weight="light"
                aria-hidden
                className={styles.pickerThumbEmpty}
              />
            )}
            {on && (
              <span className={styles.pickerCheck}>
                <Check size={14} weight="bold" aria-hidden />
              </span>
            )}
          </span>
          <span className={styles.pickerCardText}>
            <span className={styles.pickerCardTitle}>{title}</span>
            <span className={styles.pickerCardMeta}>
              {w.editionType === 'limited' ? 'Limited edition' : 'Open edition'}
            </span>
          </span>
        </Button>
      </div>
    )
  }

  const skeletons = (
    <div className={styles.pickerGrid}>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} className={styles.pickerSkeleton} aria-hidden />
      ))}
    </div>
  )

  const note = (message: string) => <div className={styles.pickerNote}>{message}</div>

  const body = () => {
    if (mode === 'name') {
      if (query.trim() === '') return note('Search by title to look across every artist.')
      if (loadingWorks) return skeletons
      if (nameResults.length === 0) return note('No prints match that title.')
      return <div className={styles.pickerGrid}>{nameResults.map(card)}</div>
    }

    if (artistId === null) {
      if (visibleArtists.length === 0) return note('No artists match that name.')
      return (
        <div className={styles.pickerList}>
          {visibleArtists.map((a) => (
            <Button
              key={a.value}
              font="dashboard"
              variant="bare"
              className={styles.pickerArtist}
              onClick={() => setArtistId(a.value)}
            >
              <span>{a.label}</span>
              <span className={styles.pickerArtistMeta}>
                <Badge label={`${a.count} prints`} variant="neutral" />
                <CaretRight size={16} weight="light" aria-hidden />
              </span>
            </Button>
          ))}
        </div>
      )
    }

    if (loadingWorks) return skeletons
    if (visibleArtistWorks.length === 0) {
      return note(
        query.trim() === ''
          ? 'Every print by this artist is already selected.'
          : 'No prints match that title.',
      )
    }
    return <div className={styles.pickerGrid}>{visibleArtistWorks.map(card)}</div>
  }

  return (
    <Modal onClose={onClose} titleId="add-artworks-title" maxWidth="min(1040px, 94vw)">
      <div className={styles.picker}>
        <div className={styles.pickerHead}>
          <div className={styles.pickerHeadRow}>
            <div>
              <h2 id="add-artworks-title" className={styles.pickerHeading}>
                Add artworks
              </h2>
              <Text font="dashboard" as="p" className={styles.pickerSub}>
                {sub}
              </Text>
            </div>
            <Button variant="ghost" icon="close" aria-label="Close" onClick={onClose} />
          </div>

          <div className={styles.pickerControls}>
            {/* One slot, one trail: the mode switch at the top level, and where
                you are once you have drilled into an artist. */}
            {currentArtist ? (
              <div className={styles.pickerCrumb}>
                <Button
                  font="dashboard"
                  variant="secondary"
                  size="small"
                  label="All artists"
                  iconLeft={<CaretLeft size={14} weight="light" aria-hidden />}
                  onClick={() => {
                    setArtistId(null)
                    setQuery('')
                  }}
                />
                <span className={styles.pickerCrumbName}>{currentArtist.label}</span>
              </div>
            ) : (
              <div className={styles.pickerModes}>
                {(
                  [
                    ['artist', 'By artist'],
                    ['name', 'By name'],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    font="dashboard"
                    variant="pill"
                    label={label}
                    aria-pressed={mode === value}
                    onClick={() => {
                      setMode(value)
                      setQuery('')
                      setArtistId(null)
                    }}
                  />
                ))}
              </div>
            )}

            <Input
              type="search"
              variant="search"
              className={styles.pickerSearch}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                mode === 'name'
                  ? 'Search by title'
                  : currentArtist
                    ? `Search ${currentArtist.label}'s prints`
                    : 'Search artists'
              }
              aria-label={mode === 'name' || currentArtist ? 'Search prints' : 'Search artists'}
            />
          </div>
        </div>

        <div className={styles.pickerBody}>{body()}</div>

        <div className={styles.pickerFoot}>
          <div className={styles.pickerCount}>
            <Text
              font="dashboard"
              as="span"
              className={ticked.size > 0 ? styles.pickerCountOn : undefined}
            >
              {ticked.size} selected
            </Text>
            {ticked.size > 0 && (
              <Button
                font="dashboard"
                variant="ghost"
                size="small"
                label="Clear"
                onClick={() => setTicked(new Set())}
              />
            )}
          </div>
          {addError && (
            <p role="alert" className={styles.pickerError}>
              {addError}
            </p>
          )}
          <ButtonGroup align="right">
            <Button font="dashboard" variant="secondary" label="Cancel" onClick={onClose} />
            <Button
              font="dashboard"
              variant="primary"
              label={saving ? 'Adding…' : `Add ${ticked.size}`}
              disabled={ticked.size === 0 || saving}
              onClick={handleAdd}
            />
          </ButtonGroup>
        </div>
      </div>
    </Modal>
  )
}
