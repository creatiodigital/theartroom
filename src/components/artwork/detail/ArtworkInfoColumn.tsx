import type { ReactNode } from 'react'
import Link from 'next/link'
import c from 'classnames'

import { Share } from '@/components/ui/Share'

import styles from './ArtworkDetail.module.scss'

/**
 * The artwork pages' info column (docs/public-redesign/artwork.md), one component for image works
 * and Objects alike (owner, 2026-11-25: "Don't you have the same component for all?? … reuse"):
 * the artist (a link to their page), the work as the <h1>, the year; under the divider the
 * technical lines, then the work's own facts and actions (`children`: an image's print block and
 * views, an Object's size and Inquire), then Share.
 */
export function ArtworkInfoColumn({
  author,
  artistHandler,
  title,
  year,
  technique,
  shareUrl,
  className,
  children,
}: {
  author: string | null
  artistHandler?: string | null
  title: string | null
  year?: string | null
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
      </div>

      <div className={styles.purchase}>
        {/* The technical lines open the block, under the divider: apart from the year, just
            above the work's own facts (owner, 2026-11-20). */}
        {technique}
        {children}
        <Share title={title || 'Artwork'} url={shareUrl} className={styles.share} />
      </div>
    </aside>
  )
}
