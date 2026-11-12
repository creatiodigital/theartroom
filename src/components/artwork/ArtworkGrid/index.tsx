'use client'

import Link from 'next/link'

import { PrintPresentation } from '@/components/printPresentation/PrintPresentation'
import { OrderPrintButton } from '@/components/ui/OrderPrintButton'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { Text } from '@/components/ui/Typography'
import { usePurchasesPaused } from '@/hooks/usePurchasesPaused'
import type { ArtworkSale } from '@/lib/editions/artworkSale'
import type { PresentationView } from '@/lib/printPresentation/record'

import styles from './ArtworkGrid.module.scss'

type Artwork = {
  id: string
  slug: string
  name: string
  title?: string | null
  author?: string | null
  /** Artist name already resolved for THIS artwork (author winning over the
   *  account name). /prints spans several artists, so it cannot pass one
   *  fallback down the way a single-artist page can — it carries the name per
   *  card instead. */
  artistName?: string | null
  year?: string | null
  technique?: string | null
  dimensions?: string | null
  imageUrl?: string | null
  // Real pixel dimensions when known. Used per-tile so next/image
  // reserves the correct slot — fixes CLS without forcing a square crop.
  originalWidth?: number | null
  originalHeight?: number | null
  /**
   * What this card says about buying a print, resolved server-side by
   * `resolveArtworkSale`. Three states, and they are not interchangeable:
   *
   *   undefined / null        not for sale — no commerce on the card at all
   *   { minPriceCents: n }    on sale at n
   *   { minPriceCents: null } live, but nothing left → "Sold out"
   *
   * This is per-artwork rather than per-grid because the artist and exhibition
   * grids hold everything an artist made, sellable or not. /prints could use a
   * grid-wide flag only because its query had already filtered the list down to
   * purchasable work.
   */
  sale?: ArtworkSale | null
  /** The work as a photo of the real print (frame or sheet), when one is current and the
   *  switch is on. Absent: the bare image, as always. */
  presentation?: PresentationView | null
}

interface ArtworkGridProps {
  /** Name the artist on each card: only on a grid of several artists (Prints). */
  showArtist?: boolean
  /** Add the edition to the year line, "2026 · Limited edition" (Prints, prints.md §4). */
  showEdition?: boolean
  artworks: Artwork[]
  artistName?: string
  /**
   * The exhibition this grid belongs to, if any. Rides along on every card's
   * link so the artwork page knows which set the visitor is walking and can
   * offer previous/next arrows through it. Absent on /prints and the artist
   * page, where a card is just a card.
   */
  exhibitionSlug?: string
  /**
   * Set by /prints. Same job as `exhibitionSlug` — it marks the cards as part
   * of a set the visitor is walking — but the set is the gallery's selection,
   * which has no slug of its own to carry. A flag rather than an identifier
   * because there is exactly one such collection.
   */
  fromPrints?: boolean
  /**
   * The artist whose profile this grid sits on, if any. Same job again, keyed
   * by the handler that already addresses the profile page.
   */
  artistHandler?: string
  /**
   * No space of its own below the last row: for a page where something follows the grid and sets
   * the spacing itself (the artist page, where "Artist's Exhibitions" comes next). By default the
   * grid keeps its bottom margin, which holds it off the footer where it ends the page.
   */
  flushBottom?: boolean
  /** 4: four across from 1024 px and two (only the first two) below — "More by the artist". */
  columns?: 3 | 4
}

// Fallback ratio for legacy artworks uploaded before EXIF capture.
// 4:3 is closer to the average gallery image than 1:1 and avoids the
// jarring shift a square placeholder gives when the real image is wide.
const FALLBACK_WIDTH = 800
const FALLBACK_HEIGHT = 600

export const ArtworkGrid = ({
  artworks,
  artistName,
  exhibitionSlug,
  fromPrints,
  artistHandler,
  flushBottom,
  columns = 3,
  showArtist = false,
  showEdition = false,
}: ArtworkGridProps) => {
  // Admin kill switch. Hides the whole commerce block — price, CTA and the
  // sold-out badge alike — across every grid that uses this component. The
  // wizard and the payment actions still enforce the pause server-side.
  const purchasesPaused = usePurchasesPaused()

  // At most one set is being walked, and each grid passes exactly one. Ordered
  // most specific first, so a caller passing two gets the narrower set rather
  // than whichever happened to be checked first.
  const context = exhibitionSlug
    ? `?exhibition=${encodeURIComponent(exhibitionSlug)}`
    : artistHandler
      ? `?artist=${encodeURIComponent(artistHandler)}`
      : fromPrints
        ? '?from=prints'
        : ''

  return (
    <div
      className={[styles.grid, flushBottom && styles.flushBottom, columns === 4 && styles.four]
        .filter(Boolean)
        .join(' ')}
    >
      {artworks.map((artwork) => {
        const w = artwork.originalWidth ?? FALLBACK_WIDTH
        const h = artwork.originalHeight ?? FALLBACK_HEIGHT
        const sale = purchasesPaused ? null : artwork.sale
        return (
          <div key={artwork.id} className={styles.card}>
            <div className={styles.imageWrapper}>
              {artwork.imageUrl ? (
                <Link
                  href={`/artworks/${artwork.slug}${context}`}
                  className={styles.viewDetailsLink}
                >
                  <PrintPresentation
                    view={artwork.presentation}
                    size="small"
                    renderClassName={styles.presentationRender}
                  >
                    {(placement) =>
                      placement === 'window' ? (
                        // In the render's window, which has the image's own shape: it fills it.
                        <ProtectedImage
                          src={artwork.imageUrl!}
                          alt={artwork.title || artwork.name || 'Artwork'}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <ProtectedImage
                          src={artwork.imageUrl!}
                          alt={artwork.title || artwork.name || 'Artwork'}
                          className={styles.image}
                          width={w}
                          height={h}
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      )
                    }
                  </PrintPresentation>
                </Link>
              ) : (
                <div className={styles.placeholder}>
                  <Text as="span" size="sm">
                    No image
                  </Text>
                </div>
              )}
            </div>
            <div className={styles.info}>
              {/* The caption left, Order print on its right (under it on phones):
                  docs/public-redesign/components.md "ArtworkCard". The artist is
                  named only on a grid of several artists (Prints). */}
              <div className={styles.caption}>
                <h3 className={styles.title}>
                  <em>{artwork.title || artwork.name}</em>
                </h3>
                {showArtist && (
                  <span className={styles.artist}>
                    {/* Per-card first: it is the only value that is right on a
                        multi-artist listing. Then the free-text override, then the
                        page-level fallback a single-artist page supplies. */}
                    {artwork.artistName || artwork.author || artistName || ''}
                  </span>
                )}
                {(() => {
                  const edition =
                    showEdition && artwork.sale
                      ? artwork.sale.editionType === 'limited'
                        ? 'Limited edition'
                        : 'Open edition'
                      : null
                  const line = [artwork.year, edition].filter(Boolean).join(' · ')
                  return line ? <p className={styles.year}>{line}</p> : null
                })()}
              </div>
              {sale && (
                <div className={styles.orderAction}>
                  {/* `null` = nothing left to buy, and that is the one number
                      the card still speaks. The work STAYS on the page and says
                      so: a sold-out edition is the best thing there, while an
                      "Order print" button leading to a wizard that refuses the
                      sale is the worst. */}
                  {sale.minPriceCents != null ? (
                    // To the artwork page, NEVER straight to the wizard. The
                    // artwork page is the single door to checkout: the grid's
                    // job is to earn a click, not to close a sale off a thumbnail.
                    <OrderPrintButton
                      href={`/artworks/${artwork.slug}${context}`}
                      className={styles.orderButton}
                    />
                  ) : (
                    <span className={styles.soldOut}>Sold out</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
