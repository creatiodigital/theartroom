import { Children, type ReactNode } from 'react'
import Link from 'next/link'
import c from 'classnames'

import { Share } from '@/components/ui/Share'

import styles from './ArtworkDetail.module.scss'

/**
 * The artwork pages' info column, one component for image works and Objects alike (owner,
 * 2026-11-25: "Don't you have the same component for all?? … reuse"), in blocks under dividers
 * (docs/public-redesign/artwork.md "Info column, refined"):
 * 1. who and what: the artist (a link to their page), the work as the <h1>, the year;
 * 2. the action, right under the year's divider (owner, 2026-11-25): the price and Order a print,
 *    or Inquire when there is nothing to order;
 * 3. how it is made: the technical lines (an Object's materials), then the size (owner,
 *    2026-11-25: "Move the sizes where the technical info is", "move the materials first, sizes
 *    later"); gone when both are empty;
 * 4. the rest (`children`: an image's print kind and sizes, the views), then Share.
 */
export function ArtworkInfoColumn({
  author,
  artistHandler,
  title,
  year,
  size,
  action,
  technique,
  shareUrl,
  className,
  children,
}: {
  author: string | null
  artistHandler?: string | null
  title: string | null
  year?: string | null
  /** The size line, in the visitor's unit: an Object's "29 × 39 × 14 cm · 15 kg", or the sizes of
   *  an image work that is not for sale (one for sale says them in its print details). */
  size?: string | null
  /** The price and Order a print (ArtworkPurchase), or Inquire. */
  action?: ReactNode
  /** The technical lines, already rendered (ArtworkTechnique). */
  technique?: ReactNode
  /** The work's canonical address (SITE_URL + /artworks/slug), for Share. */
  shareUrl: string
  className?: string
  children?: ReactNode
}) {
  const hasRest = Children.toArray(children).length > 0
  return (
    <aside className={c(styles.info, className)}>
      <div className={styles.identity}>
        {author &&
          (artistHandler ? (
            <Link href={`/artists/${artistHandler}`} className={styles.artist}>
              {author}
            </Link>
          ) : (
            <span className={styles.artist}>{author}</span>
          ))}
        {/* The work leads, and it is the <h1>: this page is about the artwork. */}
        {title && <h1 className={styles.title}>{title}</h1>}
        {year && <span className={styles.fact}>{year}</span>}
      </div>

      {action && <div className={styles.action}>{action}</div>}

      {(technique || size) && (
        <div className={styles.making}>
          {technique}
          {size && <p className={styles.makingSize}>{size}</p>}
        </div>
      )}

      <div className={c(styles.rest, hasRest && styles.restDivided)}>
        {children}
        <Share
          type="artwork"
          title={title || 'Artwork'}
          artist={author}
          url={shareUrl}
          className={styles.share}
        />
      </div>
    </aside>
  )
}
