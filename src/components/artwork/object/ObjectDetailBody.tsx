'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CaretLeft, CaretRight, Cube } from '@phosphor-icons/react'
import c from 'classnames'

import { SHOW_NEIGHBOUR_ARROWS } from '@/components/artwork/detail/neighbourArrows'
import type { ArtworkNeighbours } from '@/components/artwork/detail/ArtworkDetailBody'
import { ModelViewer } from '@/components/objects/ModelViewer'
import { Button } from '@/components/ui/Button'
import { InquireSidebar } from '@/components/ui/InquireSidebar'
import { UnitsSwitch } from '@/components/ui/UnitsSwitch'
import { ArtworkInfoColumn } from '@/components/artwork/detail/ArtworkInfoColumn'
import { ArtworkInquire } from '@/components/artwork/detail/ArtworkInquire'
import { track } from '@/lib/analytics/track'
import { formatObjectSize, formatWeight } from '@/lib/units/format'
import { useUnits } from '@/lib/units/UnitsProvider'

import detail from '@/components/artwork/detail/ArtworkDetail.module.scss'
import styles from './ObjectDetail.module.scss'

/** One view in the stage: the cover, or a labelled photo (Front, Back, Side…). */
export type ObjectView = {
  id: string
  url: string
  /** "Front", "In a room"; null for the cover. */
  label: string | null
  caption: string | null
  /** The 72 px tile's crop (the cover's square crop; the middle for the photos). */
  thumbPosition: string
}

export type ObjectPageArtwork = {
  id: string
  slug: string
  name: string
  title: string | null
  author: string | null
  year: string | null
  heightCm: number | null
  widthCm: number | null
  depthCm: number | null
  weightKg: number | null
  imageUrl: string | null
  /** The ready 3D model, if any (docs/objects O4). */
  model: { url: string } | null
}

const THREE_D_CAPTION = '3D model prepared by The Art Room'

/**
 * The top of an Object's artwork page (docs/objects O5, objects-artwork-page-desktop/-phone):
 * the stage on the left (the 3D model first when there is one, then the cover and the labelled
 * photos; 72 px tiles under it on desktop, the 3D tile first; a swipe with a progress bar on
 * phones) and the info column on the right, in the approved artwork page's frame and styles. No
 * price and no Order print: Objects are not prints; Inquire is the way forward.
 */
export function ObjectDetailBody({
  artwork,
  artist,
  views,
  technique,
  neighbours,
}: {
  artwork: ObjectPageArtwork
  artist: { name: string; lastName: string; handler: string }
  views: ObjectView[]
  /** The materials, already rendered on the server (as ArtworkTechnique). */
  technique: ReactNode
  neighbours?: ArtworkNeighbours | null
}) {
  const { unit } = useUnits()
  const [inquireOpen, setInquireOpen] = useState(false)
  const [viewIndex, setViewIndex] = useState(0)
  // The 3D model first when there is one (owner, 2026-11-25: "Make the 3D appear first"), then the
  // cover, the photos and reels.
  const [in3d, setIn3d] = useState(!!artwork.model)
  const [resetKey, setResetKey] = useState(0)
  const [wanted, setWanted] = useState<ReadonlySet<number>>(() => new Set([0, 1]))
  const stageRef = useRef<HTMLDivElement>(null)
  const viewsTrack = useRef<HTMLDivElement>(null)

  const title = artwork.title || artwork.name || 'Artwork'
  const author = artwork.author || `${artist.name} ${artist.lastName}`.trim()
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/artworks/${artwork.slug}` : ''

  const size = formatObjectSize(artwork, unit)
  const weight = artwork.weightKg ? formatWeight(artwork.weightKg) : null
  const sizeLine = [size, weight].filter(Boolean).join(' · ')

  const showView = (index: number) => {
    setIn3d(false)
    setViewIndex(index)
    setWanted((w) => (w.has(index) && w.has(index + 1) ? w : new Set([...w, index, index + 1])))
    const strip = viewsTrack.current
    if (strip) strip.scrollTo({ left: index * strip.clientWidth, behavior: 'smooth' })
  }
  const onViewsScroll = () => {
    const strip = viewsTrack.current
    if (!strip || strip.clientWidth === 0) return
    const index = Math.round(strip.scrollLeft / strip.clientWidth)
    if (index !== viewIndex && index >= 0 && index < views.length) {
      setViewIndex(index)
      setWanted((w) => (w.has(index + 1) ? w : new Set([...w, index + 1])))
    }
  }
  // A resize changes the slides' width: keep the picked one in place.
  const viewIndexRef = useRef(viewIndex)
  useEffect(() => {
    viewIndexRef.current = viewIndex
  }, [viewIndex])
  useEffect(() => {
    const strip = viewsTrack.current
    if (!strip || typeof ResizeObserver === 'undefined') return
    let width = strip.clientWidth
    const observer = new ResizeObserver(() => {
      if (strip.clientWidth === width) return
      width = strip.clientWidth
      strip.scrollLeft = viewIndexRef.current * width
    })
    observer.observe(strip)
    return () => observer.disconnect()
  }, [])

  const open3d = () => {
    setIn3d(true)
    // From the info column on a phone the stage is above: bring it into view.
    stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const current = views[viewIndex]
  const caption = in3d
    ? THREE_D_CAPTION
    : current
      ? [current.label, current.caption].filter(Boolean).join(' · ')
      : ''

  return (
    <>
      <div className={detail.layout}>
        <ArtworkInfoColumn
          author={author}
          artistHandler={artist.handler}
          title={title}
          year={artwork.year}
          technique={technique}
          shareUrl={shareUrl}
          className={styles.info}
        >
          {sizeLine && (
            <span className={styles.sizeRow}>
              <span className={detail.fact}>{sizeLine}</span>
              <UnitsSwitch />
            </span>
          )}
          <ArtworkInquire
            divided
            onClick={() => {
              track('inquire_open', { item_id: artwork.slug, surface: 'page', for_sale: false })
              setInquireOpen(true)
            }}
          />
        </ArtworkInfoColumn>

        <div className={styles.stageColumn}>
          <div ref={stageRef} className={c(detail.imageArea, styles.stage)}>
            <div
              ref={viewsTrack}
              className={c(detail.viewsTrack, in3d && styles.hidden)}
              onScroll={onViewsScroll}
              aria-hidden={in3d}
            >
              {views.map((view, i) => (
                <div key={view.id} className={detail.viewSlide}>
                  <img
                    src={view.url}
                    alt={`${title}${view.label ? `: ${view.label}` : ''}`}
                    className={styles.stagePhoto}
                    loading={wanted.has(i) ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                </div>
              ))}
            </div>

            {in3d && artwork.model && (
              <div className={styles.three}>
                <ModelViewer
                  url={artwork.model.url}
                  tone="light"
                  resetKey={resetKey}
                  className={styles.viewer}
                />
                <Button
                  variant="bare"
                  label="Reset view"
                  className={styles.reset}
                  onClick={() => setResetKey((k) => k + 1)}
                />
              </div>
            )}

            {/* Phones: where you are, and the way into (and out of) the 3D model. */}
            {!in3d && views.length > 1 && (
              <span className={styles.counter}>
                {viewIndex + 1} / {views.length}
              </span>
            )}
            {artwork.model && (
              <Button
                variant="bare"
                className={styles.stage3d}
                onClick={() => (in3d ? setIn3d(false) : open3d())}
              >
                {in3d ? (
                  'Photos'
                ) : (
                  <>
                    <Cube size={16} weight="regular" aria-hidden />
                    3D
                  </>
                )}
              </Button>
            )}

            {SHOW_NEIGHBOUR_ARROWS && neighbours?.prev && (
              <Button
                variant="bare"
                href={neighbours.prev.href}
                className={c(detail.arrow, detail.arrowPrev)}
                title={neighbours.prev.title}
                aria-label={`Previous work: ${neighbours.prev.title}`}
              >
                <CaretLeft size={18} weight="light" aria-hidden />
              </Button>
            )}
            {SHOW_NEIGHBOUR_ARROWS && neighbours?.next && (
              <Button
                variant="bare"
                href={neighbours.next.href}
                className={c(detail.arrow, detail.arrowNext)}
                title={neighbours.next.title}
                aria-label={`Next work: ${neighbours.next.title}`}
              >
                <CaretRight size={18} weight="light" aria-hidden />
              </Button>
            )}
          </div>

          {/* Phones: the progress bar under the stage. */}
          {!in3d && views.length > 1 && (
            <div aria-hidden className={styles.segments}>
              {views.map((view, i) => (
                <span key={view.id} className={c(styles.segment, i === viewIndex && styles.on)} />
              ))}
            </div>
          )}

          {/* Tablets and desktop: the views as 72 px tiles, the 3D model first. */}
          {(views.length > 1 || artwork.model) && (
            <div role="group" aria-label="Views of the work" className={styles.thumbs}>
              {artwork.model && (
                <Button
                  variant="bare"
                  className={c(styles.thumb, styles.thumb3d, in3d && styles.thumbOn)}
                  aria-pressed={in3d}
                  aria-label="View in 3D"
                  onClick={open3d}
                >
                  <Cube size={22} weight="light" aria-hidden />
                  3D
                </Button>
              )}
              {views.map((view, i) => (
                <Button
                  key={view.id}
                  variant="bare"
                  className={c(styles.thumb, !in3d && i === viewIndex && styles.thumbOn)}
                  aria-pressed={!in3d && i === viewIndex}
                  aria-label={view.label ?? `${title}: cover`}
                  onClick={() => showView(i)}
                >
                  <img
                    src={view.url}
                    alt=""
                    className={styles.thumbImage}
                    style={{ objectPosition: view.thumbPosition }}
                    loading="lazy"
                    decoding="async"
                  />
                </Button>
              ))}
            </div>
          )}
          {caption && <p className={styles.caption}>{caption}</p>}
        </div>
      </div>

      <InquireSidebar
        isOpen={inquireOpen}
        onClose={() => setInquireOpen(false)}
        artwork={{
          slug: artwork.slug,
          title,
          year: artwork.year ? parseInt(artwork.year, 10) : undefined,
          artistName: author,
          imageUrl: artwork.imageUrl || '',
          presentation: null,
        }}
      />
    </>
  )
}
