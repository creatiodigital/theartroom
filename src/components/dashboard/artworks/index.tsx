'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import {
  Image as ImageIcon,
  PencilSimple,
  Play,
  Plus,
  SpeakerHigh,
  Stop,
  TextT,
  Trash,
  VideoCamera,
  X,
} from '@phosphor-icons/react'
import c from 'classnames'

import { isSafeImageSrc } from '@/lib/imageSafety'
import {
  ARTWORK_TYPE_FILTERS,
  readArtworkTypeFilter,
  writeArtworkTypeFilter,
  type ArtworkTypeFilter,
} from '@/lib/artworkTypeFilter'

import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Callout } from '@/components/admin/ui/Callout'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { FeedbackBar } from '@/components/admin/ui/FeedbackBar'
import { ListPanel } from '@/components/admin/ui/ListPanel'
import { SearchField } from '@/components/admin/ui/SearchField'
import { SegmentedControl } from '@/components/admin/ui/SegmentedControl'
import { SORTABLE_KEYBOARD_HINT, SortableList } from '@/components/admin/ui/SortableList'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { AddArtworkModal } from '@/components/dashboard/AddArtworkModal'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'

import styles from './artworks.module.scss'

const TITLE = 'Artwork library'
const DESCRIPTION = 'Everything you can hang in your exhibitions. Drag to change the order.'

/** How each media type reads in the type filter and in a row's meta line. */
const TYPE_LABEL: Record<string, string> = {
  image: 'Image',
  text: 'Text',
  sound: 'Sound',
  video: 'Video',
}

const FILTER_OPTIONS = ARTWORK_TYPE_FILTERS.map((id) => ({
  id,
  label: id === 'all' ? 'All' : TYPE_LABEL[id],
}))

/**
 * The technique is rich text (HTML from the editor): one plain line for the
 * meta row. The result is rendered as text, never as HTML.
 */
const plainText = (html: string | null | undefined): string =>
  (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

type Exhibition = {
  id: string
  mainTitle: string
}

type ExhibitionArtwork = {
  id: string
  exhibitionId: string
  exhibition: Exhibition
}

type Artwork = {
  id: string
  name: string
  artworkType: string
  title: string | null
  year: string | null
  technique: string | null
  imageUrl: string | null
  videoUrl: string | null
  textContent: string | null
  soundUrl: string | null
  createdAt: string
  order?: number
  exhibitionArtworks: ExhibitionArtwork[]
  /** Buyable as a print right now: print sales on, and either a live priced
   *  variant (limited) or an artwork-level price (open). Computed by
   *  GET /api/artworks with the same rule the checkout enforces. Only images
   *  can ever be true. */
  sellingNow?: boolean
}

// Extracts first frame from a video URL and renders it as a thumbnail
function VideoThumbnail({ videoUrl, alt }: { videoUrl: string; alt: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = videoUrl

    const handleLoadedData = () => {
      video.currentTime = 0
    }

    const handleSeeked = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        setReady(true)
      }
      video.removeAttribute('src')
      video.load()
    }

    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('seeked', handleSeeked)

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('seeked', handleSeeked)
      video.removeAttribute('src')
      video.load()
    }
  }, [videoUrl])

  return (
    <canvas
      ref={canvasRef}
      aria-label={alt}
      style={{
        // Match the still-image tile: fill the box and CONTAIN, so a landscape
        // video reads as landscape instead of being cropped square. The canvas
        // carries the video's natural dimensions, so contain has a real ratio
        // to work with.
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        borderRadius: 'var(--radius-sm)',
        display: ready ? 'block' : 'none',
      }}
    />
  )
}

type ArtworkThumbProps = {
  artwork: Artwork
  /** The row's title, for the sound button's name. */
  title: string
  isPlaying: boolean
  onTogglePlay: (artworkId: string, soundUrl: string) => void
}

/**
 * The row's 64px tile (artist.md §2), in today's order: the picture (an image,
 * or a video's poster), a video's first frame, the sound preview, else an icon
 * by type on the warm tile. Pictures are CONTAINED, not cropped: the box is
 * square, and cropping hid whether a work is landscape or portrait.
 */
function ArtworkThumb({ artwork, title, isPlaying, onTogglePlay }: ArtworkThumbProps) {
  if (
    (artwork.artworkType === 'image' || artwork.artworkType === 'video') &&
    artwork.imageUrl &&
    isSafeImageSrc(artwork.imageUrl)
  ) {
    return (
      <span className={styles.thumb}>
        <Image
          src={artwork.imageUrl}
          alt=""
          width={64}
          height={64}
          // Skip the Vercel optimizer (already-optimized R2/CDN .webp); cold
          // re-encodes broke images on first load (AR-125).
          unoptimized
          className={styles.thumbImage}
        />
      </span>
    )
  }

  if (artwork.artworkType === 'video' && artwork.videoUrl) {
    return (
      <span className={c(styles.thumb, styles.tile)}>
        <VideoThumbnail videoUrl={artwork.videoUrl} alt={artwork.title || 'Video'} />
      </span>
    )
  }

  if (artwork.artworkType === 'sound') {
    const soundUrl = artwork.soundUrl
    if (soundUrl) {
      return (
        <Button
          variant="bare"
          font="dashboard"
          className={c(styles.thumb, styles.tile, styles.play)}
          aria-label={isPlaying ? `Stop ${title}` : `Play ${title}`}
          onClick={() => onTogglePlay(artwork.id, soundUrl)}
        >
          {isPlaying ? (
            <Stop size={22} weight="fill" aria-hidden className={styles.playing} />
          ) : (
            <Play size={22} weight="light" aria-hidden />
          )}
        </Button>
      )
    }
    return (
      <span aria-hidden className={c(styles.thumb, styles.tile)}>
        <SpeakerHigh size={22} weight="light" />
      </span>
    )
  }

  const TypeIcon =
    artwork.artworkType === 'image'
      ? ImageIcon
      : artwork.artworkType === 'video'
        ? VideoCamera
        : TextT
  return (
    <span aria-hidden className={c(styles.thumb, styles.tile)}>
      <TypeIcon size={22} weight="light" />
    </span>
  )
}

export const ArtworkLibraryPage = () => {
  const { effectiveUser } = useEffectiveUser()
  const router = useRouter()

  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [unlinkTarget, setUnlinkTarget] = useState<{
    exhibitionArtworkId: string
    artworkName: string
    exhibitionTitle: string
  } | null>(null)
  const [unlinking, setUnlinking] = useState(false)
  const [actionError, setActionError] = useState('')
  // questions.md Q108: a failed load (it read as "No artworks yet") and a refused reorder (it was
  // ignored) are said on screen.
  const [loadError, setLoadError] = useState(false)
  const [reorderError, setReorderError] = useState('')
  // Lazily initialised from storage so the filter survives the remount that
  // editing an artwork causes. Safe against hydration: the first render is the
  // loading view (the header and "Loading artworks…", no type filter) on both
  // server and client, so the stored value cannot reach the DOM before hydration
  // is done.
  const [typeFilter, setTypeFilter] = useState<ArtworkTypeFilter>(readArtworkTypeFilter)

  // Written here rather than in an effect on `typeFilter`, so a mount that only
  // read the value does not immediately write it back.
  const selectType = useCallback((next: ArtworkTypeFilter) => {
    setTypeFilter(next)
    writeArtworkTypeFilter(next)
  }, [])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Sound preview playback
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingArtworkId, setPlayingArtworkId] = useState<string | null>(null)

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const handleTogglePlay = useCallback(
    (artworkId: string, soundUrl: string) => {
      // If the same artwork is already playing, stop it
      if (audioRef.current && playingArtworkId === artworkId) {
        audioRef.current.pause()
        audioRef.current = null
        setPlayingArtworkId(null)
        return
      }

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      // Play the new sound
      const audio = new Audio(soundUrl)
      audio.addEventListener('ended', () => {
        setPlayingArtworkId(null)
        audioRef.current = null
      })
      audio.play()
      audioRef.current = audio
      setPlayingArtworkId(artworkId)
    },
    [playingArtworkId],
  )

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Filter artworks based on selected type and search query
  const filteredArtworks = artworks.filter((artwork) => {
    // Shapes are a 2D-canvas / wallview construct, never user-managed
    // content. Hide them from the main library regardless of the type
    // filter (they still load in the wallview's MediaLibrary).
    if (artwork.artworkType === 'shape') return false
    // Type filter
    if (typeFilter !== 'all' && artwork.artworkType !== typeFilter) {
      return false
    }
    // Search filter (case-insensitive, matches title, name, and text content)
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase()
      return (
        artwork.title?.toLowerCase().includes(searchLower) ||
        artwork.name.toLowerCase().includes(searchLower) ||
        artwork.textContent?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  // Display order = the artist's saved order (Artwork.order, asc). The
  // /api/artworks endpoint already returns rows in that order, so we
  // just preserve the filter's pass-through.
  const sortedArtworks = filteredArtworks
  // Drag-reorder is available on the All tab AND inside any type filter, so an
  // artist can reorder one media type (e.g. 39 images) without the other types
  // as noise. Disabled only while searching — search results are a scattered
  // subset, not a coherent reorderable list.
  const dragEnabled = debouncedSearch.length === 0

  // Fetch artworks
  const fetchArtworks = useCallback(async () => {
    if (!effectiveUser?.id) return

    try {
      const response = await fetch(`/api/artworks?userId=${effectiveUser.id}`)
      const data = await response.json().catch(() => null)
      if (!response.ok || !Array.isArray(data)) throw new Error(`Artworks: ${response.status}`)
      setArtworks(data)
      setLoadError(false)
    } catch (error) {
      console.error('Failed to fetch artworks:', error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [effectiveUser?.id])

  useEffect(() => {
    if (effectiveUser?.id) {
      fetchArtworks()
    }
  }, [effectiveUser?.id, fetchArtworks])

  const handleAddSuccess = useCallback(() => {
    fetchArtworks()
  }, [fetchArtworks])

  const handleDeleteClick = useCallback((id: string, name: string) => {
    setActionError('')
    setDeleteTarget({ id, name })
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return

    setActionError('')
    setDeleting(true)
    try {
      const response = await fetch(`/api/artworks/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchArtworks()
        setDeleteTarget(null)
      } else {
        const data = await response.json().catch(() => ({}))
        setActionError(data.error || 'Failed to delete artwork')
      }
    } catch (error) {
      console.error('Delete error:', error)
      setActionError('Failed to delete artwork')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, fetchArtworks])

  const handleUnlinkClick = useCallback(
    (exhibitionArtworkId: string, artworkName: string, exhibitionTitle: string) => {
      setActionError('')
      setUnlinkTarget({ exhibitionArtworkId, artworkName, exhibitionTitle })
    },
    [],
  )

  const handleUnlinkConfirm = useCallback(async () => {
    if (!unlinkTarget) return

    setActionError('')
    setUnlinking(true)
    try {
      const response = await fetch(`/api/exhibition-artworks/${unlinkTarget.exhibitionArtworkId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchArtworks()
        setUnlinkTarget(null)
      } else {
        setActionError('Failed to remove from exhibition')
      }
    } catch (error) {
      console.error('Unlink error:', error)
      setActionError('Failed to remove from exhibition')
    } finally {
      setUnlinking(false)
    }
  }, [unlinkTarget, fetchArtworks])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Reorder within the VISIBLE list — which may be a single media type's
    // subset when a filter is active.
    const visible = sortedArtworks
    const oldIndex = visible.findIndex((a) => a.id === active.id)
    const newIndex = visible.findIndex((a) => a.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newVisible = arrayMove(visible, oldIndex, newIndex)

    // Slot preservation: rebuild the full library order. The visible items take
    // their new order in the slots they already occupied; every other item
    // (other media types, hidden shapes) stays exactly where it is. So
    // reordering the images alone leaves text/sound/video untouched, and the
    // new order still reads correctly on the All tab.
    const visibleIds = new Set(visible.map((a) => a.id))
    let vi = 0
    const next = artworks.map((a) => (visibleIds.has(a.id) ? newVisible[vi++] : a))

    setArtworks(next)

    try {
      const response = await fetch('/api/artworks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkIds: next.map((a) => a.id) }),
      })
      if (!response.ok) throw new Error(`Reorder: ${response.status}`)
    } catch (error) {
      console.error('Error reordering artworks:', error)
      // Refetch to restore server state on error (a refused reply too, Q108).
      setReorderError("Couldn't save the new order. Please try again.")
      fetchArtworks()
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <AdminPageHeader title={TITLE} description={DESCRIPTION} />
        <ListPanel label="Artworks">
          <p className={styles.loading}>Loading artworks…</p>
        </ListPanel>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <AdminPageHeader
        title={TITLE}
        description={DESCRIPTION}
        actions={
          <Button
            variant="bare"
            font="dashboard"
            className={styles.add}
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} weight="light" aria-hidden />
            Add artwork
          </Button>
        }
      />

      {/* No ×: a dismissed load error would leave an empty page (as Q75). */}
      {loadError && (
        <Callout tone="red" role="alert">
          Your artworks could not be loaded. Refresh the page to try again.
        </Callout>
      )}
      {reorderError && (
        <FeedbackBar tone="error" onDismiss={() => setReorderError('')}>
          {reorderError}
        </FeedbackBar>
      )}

      {!loadError && (
        <ListPanel
          label="Artworks"
          toolbar={
            <>
              <SegmentedControl
                label="Type"
                options={FILTER_OPTIONS}
                value={typeFilter}
                onChange={selectType}
              />
              <div className={styles.search}>
                <SearchField
                  label="Search artworks"
                  placeholder="Search by title or content"
                  value={searchQuery}
                  onChange={setSearchQuery}
                />
              </div>
            </>
          }
          footnote={dragEnabled && sortedArtworks.length > 0 ? SORTABLE_KEYBOARD_HINT : undefined}
        >
          {sortedArtworks.length === 0 ? (
            // Shapes are never listed: a library of shapes alone has no artworks yet (Q108 e).
            artworks.every((artwork) => artwork.artworkType === 'shape') ? (
              <EmptyState
                title="No artworks yet."
                text={
                  <>
                    Click <strong>Add artwork</strong> to create your first one.
                  </>
                }
              />
            ) : (
              <EmptyState title="No artworks match this filter." />
            )
          ) : (
            <SortableList
              onDragEnd={handleDragEnd}
              numbered={false}
              sortable={dragEnabled}
              rows={sortedArtworks.map((artwork) => {
                const title = artwork.title || 'Artwork'
                const meta = [artwork.year?.trim() ?? '', plainText(artwork.technique)].filter(
                  Boolean,
                )
                return {
                  id: artwork.id,
                  title,
                  href: `/dashboard/artworks/${artwork.id}/edit`,
                  thumb: (
                    <ArtworkThumb
                      artwork={artwork}
                      title={title}
                      isPlaying={playingArtworkId === artwork.id}
                      onTogglePlay={handleTogglePlay}
                    />
                  ),
                  sub: (
                    <>
                      <span className={styles.meta}>
                        <span>{TYPE_LABEL[artwork.artworkType] ?? artwork.artworkType}</span>
                        {meta.length > 0 && <span>{meta.join(' · ')}</span>}
                        {artwork.sellingNow && (
                          <StatusPill label="Selling prints" tone="green" shape="tag" dot />
                        )}
                      </span>
                      {/* Not drawn, kept (questions.md Q105): the library's only way
                        to take a work out of an exhibition. */}
                      {artwork.exhibitionArtworks.length > 0 && (
                        <span className={styles.exhibitions}>
                          <span className={styles.exhibitionsLabel}>In:</span>
                          {artwork.exhibitionArtworks.map((ea) => (
                            <span key={ea.id} className={styles.exhibitionTag}>
                              {ea.exhibition.mainTitle}
                              <Button
                                variant="bare"
                                font="dashboard"
                                className={styles.unlink}
                                onClick={() =>
                                  handleUnlinkClick(
                                    ea.id,
                                    artwork.title || 'Artwork',
                                    ea.exhibition.mainTitle,
                                  )
                                }
                                title={`Remove from ${ea.exhibition.mainTitle}`}
                                aria-label={`Remove from ${ea.exhibition.mainTitle}`}
                              >
                                <X size={12} weight="light" aria-hidden />
                              </Button>
                            </span>
                          ))}
                        </span>
                      )}
                    </>
                  ),
                  actions: (
                    <>
                      <Button
                        variant="bare"
                        font="dashboard"
                        className={styles.edit}
                        onClick={() => router.push(`/dashboard/artworks/${artwork.id}/edit`)}
                      >
                        <PencilSimple size={16} weight="light" aria-hidden />
                        Edit
                      </Button>
                      <Button
                        variant="bare"
                        font="dashboard"
                        className={styles.trash}
                        aria-label={`Delete ${title}`}
                        onClick={() => handleDeleteClick(artwork.id, artwork.title || 'Artwork')}
                      >
                        <Trash size={16} weight="light" aria-hidden />
                      </Button>
                    </>
                  ),
                }
              })}
            />
          )}
        </ListPanel>
      )}

      {showAddModal && (
        <AddArtworkModal
          userId={effectiveUser?.id ?? ''}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
        />
      )}

      {deleteTarget && (
        <AdminConfirmModal
          title="Delete artwork?"
          message={
            <>
              <p>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              </p>
              <p>This action cannot be undone.</p>
            </>
          }
          warning={actionError || undefined}
          confirmLabel="Yes, delete"
          busyLabel="Deleting…"
          destructive
          busy={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {unlinkTarget && (
        <AdminConfirmModal
          title="Remove from exhibition?"
          message={
            <>
              <p>
                Remove <strong>{unlinkTarget.artworkName}</strong> from{' '}
                <strong>{unlinkTarget.exhibitionTitle}</strong>?
              </p>
              <p>The artwork will remain in your library.</p>
            </>
          }
          warning={actionError || undefined}
          confirmLabel="Yes, remove"
          busyLabel="Removing…"
          busy={unlinking}
          onConfirm={handleUnlinkConfirm}
          onCancel={() => setUnlinkTarget(null)}
        />
      )}
    </div>
  )
}
