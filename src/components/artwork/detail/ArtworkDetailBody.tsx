'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'

import c from 'classnames'

import { PrintPresentation } from '@/components/printPresentation/PrintPresentation'
import { Button } from '@/components/ui/Button'
import { InquireSidebar } from '@/components/ui/InquireSidebar'
import { Share } from '@/components/ui/Share'
import { usePurchasesPaused } from '@/hooks/usePurchasesPaused'
import type { VariantEditionLineParts } from '@/lib/editions/variantEditionLines'
import { ArtworkAvailabilityCard } from './ArtworkAvailabilityCard'
import { SHOW_NEIGHBOUR_ARROWS } from './neighbourArrows'
import { reportImageError } from '@/lib/observability/reportImageError'
import type { PresentationView } from '@/lib/printPresentation/record'

import styles from './ArtworkDetail.module.scss'

export type Artist = {
  id: string
  name: string
  lastName: string
  handler: string
}

export type Artwork = {
  id: string
  slug: string
  name: string
  title?: string | null
  author?: string | null
  year?: string | null
  technique?: string | null
  dimensions?: string | null
  description?: string | null
  imageUrl?: string | null
  originalWidth?: number | null
  originalHeight?: number | null
  printEnabled?: boolean | null
  /** 'open' | 'limited'. Absent = treated as open, which is the pre-limited
   *  behaviour: purchasability falls back to the artwork-level price. */
  editionType?: string | null
  /** Variants matching LIVE_VARIANT_WHERE. The ONLY thing that makes a limited
   *  edition buyable — it carries no artwork-level price. */
  liveVariantCount?: number | null
  /** EditionNumbers still available across those variants. 0 with live variants
   *  present = sold out, which is a different thing from unpurchasable. */
  availableNumberCount?: number | null
}

const FALLBACK_WIDTH = 800
const FALLBACK_HEIGHT = 800

/**
 * Resolved commerce facts for the availability card.
 *
 * Present ONLY on the standalone artwork page. The in-exhibition modal omits it
 * and keeps its existing inline CTA: a priced card, a caveat and a variant list
 * belong on a page, not in a small overlay floating over a 3D room.
 */
/** One side of the previous/next pair — a URL and the work it leads to. */
export type ArtworkNeighbour = {
  href: string
  title: string
}

/** The neighbouring works in the set the visitor is walking, if any. */
export type ArtworkNeighbours = {
  prev: ArtworkNeighbour | null
  next: ArtworkNeighbour | null
}

export type ArtworkCommerce = {
  editionType: 'open' | 'limited'
  minPriceCents: number | null
  /** Every live edition of this work, priced per row. */
  editionLines: VariantEditionLineParts[]
}

interface ArtworkDetailBodyProps {
  artwork: Artwork
  artist: Artist
  commerce?: ArtworkCommerce | null
  /**
   * Previous/next in the set the visitor came from. Plain links — following one
   * is an ordinary navigation to that artwork's URL, not a carousel. Absent
   * when there is no set, which is the common case.
   */
  neighbours?: ArtworkNeighbours | null
  /**
   * The work as a photo of the real print (frame or sheet), when one is current and the switch
   * is on. The 3D room's "View Details" passes it too since AR-174 (owner, 2026-11-04: show the
   * rendered image, as the grids do); until then it kept the plain image there (2026-10-28).
   */
  presentation?: PresentationView | null
  /**
   * The technique, already rendered — see ArtworkRichText for why the caller
   * renders it. Shown when the artwork's own field has content, as before.
   */
  technique?: ReactNode
  /** `room`: inside the 3D room's overlay (no site header above it). */
  surface?: 'page' | 'room'
}

/**
 * The artwork-detail body, shared by the standalone /artworks/[slug] page and the
 * in-exhibition ArtworkModal. Renders only the metadata + image + InquireSidebar;
 * the surrounding chrome (page header/footer, or modal overlay/X) is the caller's job.
 */
export const ArtworkDetailBody = ({
  artwork,
  artist,
  commerce,
  neighbours,
  presentation,
  technique,
  surface = 'page',
}: ArtworkDetailBodyProps) => {
  const [isInquireOpen, setIsInquireOpen] = useState(false)

  // Purchases kill switch (admin dashboard). The hook's cache is shared with
  // the artwork grids, so moving between a listing and a work doesn't re-read.
  const purchasesPaused = usePurchasesPaused()

  const displayTitle = artwork.title || artwork.name || ''
  const displayAuthor = artwork.author || `${artist.name} ${artist.lastName}`.trim()
  const imgWidth = artwork.originalWidth ?? FALLBACK_WIDTH
  const imgHeight = artwork.originalHeight ?? FALLBACK_HEIGHT
  // Portrait work gets a taller image area on desktop and a 4:5 one on phones (artwork.md
  // "Portrait works"); landscape and square stay as drawn.
  const isPortrait = imgHeight / imgWidth > 1.05

  // Canonical artwork URL — identical to the standalone page's URL, built from the slug
  // so it is correct even when opened as a modal over the exhibition route.
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/artworks/${artwork.slug}` : ''

  const inquireButton = (
    <Button
      variant="secondary"
      label="Inquire"
      onClick={() => setIsInquireOpen(true)}
      className={styles.inquire}
    />
  )

  // docs/public-redesign/artwork.md, designs/artwork-*.dc.html: the work in the grey box on the
  // left, the info column (320 px, sticky) on the right. The info column comes first in the DOM:
  // the <h1> leads for a screen reader; the grid places the picture first on the screen.
  return (
    <>
      <div className={c(styles.layout, surface === 'room' && styles.layoutRoom)}>
        <aside className={styles.info}>
          <div className={styles.identity}>
            {displayAuthor &&
              (artist.handler ? (
                <Link href={`/artists/${artist.handler}`} className={styles.artist}>
                  {displayAuthor}
                </Link>
              ) : (
                <span className={styles.artist}>{displayAuthor}</span>
              ))}
            {/* The work leads, and it is the <h1>: this page is about the artwork. */}
            {displayTitle && <h1 className={styles.title}>{displayTitle}</h1>}
            {artwork.year && <span className={styles.fact}>{artwork.year}</span>}
            {artwork.dimensions && <span className={styles.fact}>{artwork.dimensions}</span>}
            {artwork.technique && technique}
          </div>

          <div className={styles.purchase}>
            {commerce && !purchasesPaused ? (
              <ArtworkAvailabilityCard
                editionType={commerce.editionType}
                minPriceCents={commerce.minPriceCents}
                editionLines={commerce.editionLines}
                artworkSlug={artwork.slug}
                inquire={inquireButton}
              />
            ) : (
              // Not for sale (or purchases paused): enquiring is the only route forward.
              inquireButton
            )}
            <Share title={displayTitle || 'Artwork'} url={shareUrl} className={styles.share} />
          </div>
        </aside>

        <div className={c(styles.imageArea, isPortrait && styles.imageAreaPortrait)}>
          {artwork.imageUrl && (
            // Raw <img> (not next/image): reuses the image the 3D scene already cached, and
            // sidesteps the known next/image + R2 prod issue. crossOrigin matches THREE's
            // texture request so the same browser-cache entry is reused.
            // As a photo of the print, cropped to the piece and a thin border of wall so it can be
            // as large as the grey box allows; the image sits in its window, filling it.
            <PrintPresentation
              view={presentation}
              size="large"
              crop
              className={styles.presentation}
              renderClassName={styles.fit}
            >
              {(placement) => (
                <img
                  src={artwork.imageUrl ?? undefined}
                  alt={displayTitle || 'Artwork'}
                  width={imgWidth}
                  height={imgHeight}
                  className={placement === 'window' ? undefined : styles.fit}
                  crossOrigin="anonymous"
                  decoding="async"
                  onError={() =>
                    reportImageError(artwork.imageUrl, {
                      surface: 'artwork-detail',
                      alt: displayTitle || undefined,
                    })
                  }
                />
              )}
            </PrintPresentation>
          )}

          {/* Previous / next in the set the visitor came from: round buttons on the image's
              edges, plain links to the neighbouring works (artwork.md "Below the work"). */}
          {SHOW_NEIGHBOUR_ARROWS && neighbours?.prev && (
            <Button
              variant="bare"
              href={neighbours.prev.href}
              className={c(styles.arrow, styles.arrowPrev)}
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
              className={c(styles.arrow, styles.arrowNext)}
              title={neighbours.next.title}
              aria-label={`Next work: ${neighbours.next.title}`}
            >
              <CaretRight size={18} weight="light" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <InquireSidebar
        isOpen={isInquireOpen}
        onClose={() => setIsInquireOpen(false)}
        artwork={{
          slug: artwork.slug,
          title: displayTitle || '',
          year: artwork.year ? parseInt(artwork.year, 10) : undefined,
          artistName: displayAuthor || '',
          imageUrl: artwork.imageUrl || '',
          presentation,
        }}
      />
    </>
  )
}
