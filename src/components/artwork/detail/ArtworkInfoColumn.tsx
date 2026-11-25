import type { ReactNode } from 'react'
import Link from 'next/link'
import c from 'classnames'

import { Share } from '@/components/ui/Share'

import styles from './ArtworkDetail.module.scss'

/**
 * The artwork pages' info column, one component for image works and Objects alike (owner,
 * 2026-11-25: "Don't you have the same component for all?? … reuse"), in three blocks
 * (docs/public-redesign/artwork.md "Info column, refined"; designs/artwork-info-column.dc.html):
 * 1. who and what: the artist (a link to their page), the work as the <h1>, the year, the size;
 * 2. how it is made, under a divider: the technical lines (an Object's materials); gone when empty;
 * 3. under a divider, the work's actions (`children`: an image's print block, Inquire, the views),
 *    then Share.
 */
export function ArtworkInfoColumn({
  author,
  artistHandler,
  title,
  year,
  size,
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
   *  an image work that is not for sale (one for sale says them in its print block). */
  size?: string | null
  /** The technical lines, already rendered (ArtworkTechnique). */
  technique?: ReactNode
  shareUrl: string
  className?: string
  children?: ReactNode
}) {
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
        {size && <span className={styles.fact}>{size}</span>}
      </div>

      {technique && <div className={styles.making}>{technique}</div>}

      <div className={styles.actions}>
        {children}
        <Share title={title || 'Artwork'} url={shareUrl} className={styles.share} />
      </div>
    </aside>
  )
}
