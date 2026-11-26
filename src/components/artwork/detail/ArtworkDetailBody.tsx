'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'

import c from 'classnames'

import { PrintPresentation } from '@/components/printPresentation/PrintPresentation'
import { Button } from '@/components/ui/Button'
import { InquireSidebar } from '@/components/ui/InquireSidebar'
import { usePurchasesPaused } from '@/hooks/usePurchasesPaused'
import { artworkToGa, CURRENCY, euros } from '@/lib/analytics/events'
import { track } from '@/lib/analytics/track'
import { artworkSizesText, type ArtworkSizes } from '@/lib/editions/artworkSizes'
import type { VariantEditionLineParts } from '@/lib/editions/variantEditionLines'
import { ArtworkPrintDetails, ArtworkPurchase } from './ArtworkAvailabilityCard'
import { ArtworkViews, printViewTiles, VIEW_COUNT, viewAlt } from './ArtworkViews'
import { SHOW_NEIGHBOUR_ARROWS } from './neighbourArrows'
import { reportImageError } from '@/lib/observability/reportImageError'
import { PHOTO_VIEWS, type PresentationView } from '@/lib/printPresentation/record'
import { SITE_URL } from '@/lib/siteUrl'
import { isRichTextEmpty } from '@/lib/textUtils'
import { useUnits } from '@/lib/units/UnitsProvider'

import { ArtworkInfoColumn } from './ArtworkInfoColumn'
import { ArtworkInquire } from './ArtworkInquire'
import { useViewsStrip } from './useViewsStrip'
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
  /** The size line, worked out on the server (`getArtworkSizes`): the file's range, or each live
   *  variant's size. Undefined until known — the 3D room's first paint has no edition data. */
  sizes?: ArtworkSizes | null
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
  // The work's four views (owner, 2026-11-20): the framed view, then three photos of the print.
  // On the artwork page and in the 3D room's pop-up alike (owner, 2026-11-25; the pop-up kept the
  // framed view alone until then).
  const withPhotos =
    presentation?.photos && artwork.imageUrl
      ? { ...presentation, photos: presentation.photos }
      : null
  const strip = useViewsStrip(withPhotos ? VIEW_COUNT : 1)

  // Purchases kill switch (admin dashboard). The hook's cache is shared with
  // the artwork grids, so moving between a listing and a work doesn't re-read.
  const purchasesPaused = usePurchasesPaused()
  const { unit } = useUnits()

  const displayTitle = artwork.title || artwork.name || ''
  const displayAuthor = artwork.author || `${artist.name} ${artist.lastName}`.trim()
  const imgWidth = artwork.originalWidth ?? FALLBACK_WIDTH
  const imgHeight = artwork.originalHeight ?? FALLBACK_HEIGHT
  // Portrait work gets a taller image area on desktop and a 4:5 one on phones (artwork.md
  // "Portrait works"); landscape and square stay as drawn.
  const isPortrait = imgHeight / imgWidth > 1.05

  // Canonical artwork URL — identical to the standalone page's URL, built from the slug
  // so it is correct even when opened as a modal over the exhibition route.
  const shareUrl = `${SITE_URL}/artworks/${artwork.slug}`

  // GA4 view_item: a work shown with a print on offer, once per work, on the page or in the room's
  // details (where the offer arrives after a fetch). Works not for sale send nothing here.
  const forSale = !!commerce && !purchasesPaused
  // Not for sale: the sizes are the size line under the year (owner, 2026-11-25); for sale, the
  // print block says them, so they never show twice.
  const sizeLine = forSale ? null : artworkSizesText(artwork.sizes, unit)
  const viewTiles = withPhotos
    ? printViewTiles(withPhotos, artwork.imageUrl!, displayTitle || 'Artwork')
    : null
  const reportedSlug = useRef<string | null>(null)
  useEffect(() => {
    if (!forSale || !commerce || reportedSlug.current === artwork.slug) return
    reportedSlug.current = artwork.slug
    track('view_item', {
      currency: CURRENCY,
      value: commerce.minPriceCents ? euros(commerce.minPriceCents) : undefined,
      surface,
      items: [
        artworkToGa({
          slug: artwork.slug,
          title: displayTitle,
          artistName: displayAuthor,
          editionType: commerce.editionType,
          priceCents: commerce.minPriceCents,
        }),
      ],
    })
  }, [forSale, commerce, artwork.slug, displayTitle, displayAuthor, surface])

  const openInquire = () => {
    track('inquire_open', { item_id: artwork.slug, surface, for_sale: forSale })
    setIsInquireOpen(true)
  }

  // With its photos, the grey box is a strip of the four views: the framed view, then the photos,
  // each filling the box (cover: it's the same space, owner 2026-11-20). Moved by the grid below
  // Inquire, or on phones by a swipe (native scroll-snap); otherwise the framed view alone.
  const inViews = (framed: ReactNode) =>
    withPhotos ? (
      <div
        ref={strip.track}
        className={styles.viewsTrack}
        onScroll={strip.onScroll}
        data-views-track=""
      >
        <div className={styles.viewSlide}>{framed}</div>
        {PHOTO_VIEWS.map((kind, i) => (
          <div key={kind} className={styles.viewSlide}>
            <img
              src={withPhotos.photos[kind].large}
              alt={viewAlt(displayTitle || 'Artwork', i + 1)}
              className={styles.viewPhoto}
              loading={strip.wanted.has(i + 1) ? 'eager' : 'lazy'}
              decoding="async"
            />
          </div>
        ))}
      </div>
    ) : (
      framed
    )

  // docs/public-redesign/artwork.md, designs/artwork-*.dc.html: the work in the grey box on the
  // left, the info column (320 px, sticky) on the right. The info column comes first in the DOM:
  // the <h1> leads for a screen reader; the grid places the picture first on the screen.
  return (
    <>
      <div className={c(styles.layout, surface === 'room' && styles.layoutRoom)}>
        <ArtworkInfoColumn
          author={displayAuthor}
          artistHandler={artist.handler}
          title={displayTitle}
          year={artwork.year}
          size={sizeLine}
          action={
            commerce && forSale ? (
              // For sale: the price and Order a print; Inquire only once nothing is left to
              // order (owner, 2026-11-25: "remove the Inquire button if we show an order print").
              <ArtworkPurchase
                editionType={commerce.editionType}
                minPriceCents={commerce.minPriceCents}
                editionLines={commerce.editionLines}
                artworkSlug={artwork.slug}
                title={displayTitle}
                surface={surface}
                inquire={<ArtworkInquire onClick={openInquire} />}
              />
            ) : (
              // Not for sale (or purchases paused): enquiring is the only route forward.
              <ArtworkInquire onClick={openInquire} />
            )
          }
          technique={isRichTextEmpty(artwork.technique) ? null : technique}
          shareUrl={shareUrl}
        >
          {commerce && forSale && (
            <ArtworkPrintDetails
              editionType={commerce.editionType}
              sizes={artwork.sizes}
              minPriceCents={commerce.minPriceCents}
              editionLines={commerce.editionLines}
            />
          )}
          {viewTiles && (
            <ArtworkViews
              tiles={viewTiles}
              label="Views of the print"
              selected={strip.index}
              onSelect={strip.show}
              layout="grid"
              className={styles.viewsGrid}
            />
          )}
        </ArtworkInfoColumn>

        <div className={c(styles.imageArea, isPortrait && styles.imageAreaPortrait)}>
          {inViews(
            artwork.imageUrl && (
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
            ),
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

        {/* Phones: the four views in one row, right under the photo (owner, 2026-11-20). */}
        {viewTiles && (
          <ArtworkViews
            tiles={viewTiles}
            label="Views of the print"
            selected={strip.index}
            onSelect={strip.show}
            layout="row"
            className={styles.viewsRow}
          />
        )}
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
