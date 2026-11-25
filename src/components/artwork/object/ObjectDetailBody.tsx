'use client'

import { useState, type ReactNode } from 'react'
import { CaretLeft, CaretRight, Cube } from '@phosphor-icons/react'
import c from 'classnames'

import type { ArtworkNeighbours } from '@/components/artwork/detail/ArtworkDetailBody'
import { ArtworkInfoColumn } from '@/components/artwork/detail/ArtworkInfoColumn'
import { ArtworkInquire } from '@/components/artwork/detail/ArtworkInquire'
import {
  ArtworkViews,
  ViewTilePicture,
  ViewTileWord,
  type ArtworkViewTile,
} from '@/components/artwork/detail/ArtworkViews'
import { SHOW_NEIGHBOUR_ARROWS } from '@/components/artwork/detail/neighbourArrows'
import { useViewsStrip } from '@/components/artwork/detail/useViewsStrip'
import { ModelViewer } from '@/components/objects/ModelViewer'
import { Button } from '@/components/ui/Button'
import { InquireSidebar } from '@/components/ui/InquireSidebar'
import { track } from '@/lib/analytics/track'
import { formatObjectSize, formatWeight } from '@/lib/units/format'
import { useUnits } from '@/lib/units/UnitsProvider'

import detail from '@/components/artwork/detail/ArtworkDetail.module.scss'
import styles from './ObjectDetail.module.scss'

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
  /** The cover. */
  imageUrl: string | null
  originalWidth: number | null
  originalHeight: number | null
  /** The ready 3D model, if any (docs/objects O4). */
  model: { url: string } | null
}

/**
 * The top of an Object's artwork page: the image artwork page (docs/objects O5b, owner 2026-11-25:
 * "The differences: a 3D viewer and a cover. The rest SHOULD BE the same"). The grey box holds the
 * 3D model first when it is ready, then the cover; the image page's view tiles (3D, Cover) switch
 * between them, only when there is a model. The info column is the image page's: the size under
 * the year, the materials under the divider, then Inquire. No price and no Order print: Objects
 * never sell prints.
 */
export function ObjectDetailBody({
  artwork,
  artist,
  technique,
  neighbours,
  surface = 'page',
}: {
  artwork: ObjectPageArtwork
  artist: { name: string; lastName: string; handler: string }
  /** The materials, already rendered (ArtworkTechnique); null when there are none. */
  technique: ReactNode
  neighbours?: ArtworkNeighbours | null
  /** `room`: inside the 3D room's overlay (no site header above it). */
  surface?: 'page' | 'room'
}) {
  const { unit } = useUnits()
  const [inquireOpen, setInquireOpen] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  const title = artwork.title || artwork.name || 'Artwork'
  const author = artwork.author || `${artist.name} ${artist.lastName}`.trim()
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/artworks/${artwork.slug}` : ''

  const size = formatObjectSize(artwork, unit)
  const weight = artwork.weightKg ? formatWeight(artwork.weightKg) : null
  const sizeLine = [size, weight].filter(Boolean).join(' · ') || null

  // As an image work's picture: a portrait cover gets the taller box (4:5 on phones).
  const isPortrait =
    !!artwork.originalWidth &&
    !!artwork.originalHeight &&
    artwork.originalHeight / artwork.originalWidth > 1.05

  const cover = artwork.imageUrl ? (
    <img
      src={artwork.imageUrl}
      alt={title}
      width={artwork.originalWidth ?? undefined}
      height={artwork.originalHeight ?? undefined}
      className={detail.fit}
      decoding="async"
    />
  ) : null

  const three = artwork.model ? (
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
  ) : null

  // The 3D model first (owner, 2026-11-25: "Make the 3D appear first"), then the cover.
  const tiles: ArtworkViewTile[] | null =
    three && artwork.imageUrl
      ? [
          {
            key: '3d',
            label: 'View in 3D',
            content: (
              <ViewTileWord icon={<Cube size={24} weight="light" aria-hidden />} word="3D" />
            ),
          },
          { key: 'cover', label: 'Cover', content: <ViewTilePicture src={artwork.imageUrl} /> },
        ]
      : null
  const strip = useViewsStrip(tiles ? tiles.length : 1)

  return (
    <>
      <div className={c(detail.layout, surface === 'room' && detail.layoutRoom)}>
        <ArtworkInfoColumn
          author={author}
          artistHandler={artist.handler}
          title={title}
          year={artwork.year}
          size={sizeLine}
          technique={technique}
          shareUrl={shareUrl}
        >
          <ArtworkInquire
            onClick={() => {
              track('inquire_open', { item_id: artwork.slug, surface, for_sale: false })
              setInquireOpen(true)
            }}
          />
          {tiles && (
            <ArtworkViews
              tiles={tiles}
              label="Views of the work"
              selected={strip.index}
              onSelect={strip.show}
              layout="grid"
              className={detail.viewsGrid}
            />
          )}
        </ArtworkInfoColumn>

        <div className={c(detail.imageArea, isPortrait && detail.imageAreaPortrait)}>
          {tiles ? (
            <div ref={strip.track} className={detail.viewsTrack} onScroll={strip.onScroll}>
              <div className={detail.viewSlide}>{three}</div>
              <div className={detail.viewSlide}>{cover}</div>
            </div>
          ) : (
            (three ?? cover)
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

        {/* Phones: the tiles in one row, right under the box. */}
        {tiles && (
          <ArtworkViews
            tiles={tiles}
            label="Views of the work"
            selected={strip.index}
            onSelect={strip.show}
            layout="row"
            className={detail.viewsRow}
          />
        )}
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
