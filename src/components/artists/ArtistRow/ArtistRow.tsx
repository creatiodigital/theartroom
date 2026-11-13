import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'

import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'
import { isSafeImageSrc } from '@/lib/imageSafety'
import { plainParagraphsOf } from '@/lib/richText/headingAnchors'
import c from 'classnames'

import styles from './ArtistRow.module.scss'

export type ArtistRowData = {
  href: string
  name: string
  imageUrl: string | null
  /** The bio (rich text), shown whole as plain text; the exhibition page's About the artist only. */
  biography?: string | null
  /** The Artists page: their exhibitions, joined by " · " (wrapping, never cut). */
  exhibitions?: string[]
}

/**
 * One artist in a row (docs/public-redesign/artists.md; the exhibition page's "About the artist"):
 * a 3:2 portrait, the name in serif, the whole bio in its paragraphs, "→ View artist". The whole row
 * is one link to the artist page.
 */
export const ArtistRow = ({ artist, className }: { artist: ArtistRowData; className?: string }) => {
  const bio = artist.biography ? plainParagraphsOf(artist.biography) : []
  return (
    <Link href={artist.href} className={c(styles.row, bio.length > 0 && styles.withBio, className)}>
      <span className={styles.portrait}>
        {artist.imageUrl && isSafeImageSrc(artist.imageUrl) && (
          <ProtectedImage
            src={artist.imageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 132px, 180px"
            className={styles.image}
          />
        )}
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{artist.name}</span>
        {artist.exhibitions && artist.exhibitions.length > 0 && (
          <span className={styles.exhibitions}>{artist.exhibitions.join(' · ')}</span>
        )}
        {bio.length > 0 && (
          <span className={styles.bio}>
            {bio.map((paragraph, index) => (
              <span key={index} className={styles.paragraph}>
                {paragraph}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className={styles.view}>
        <ArrowRight size={18} weight="light" aria-hidden />
        View artist
      </span>
    </Link>
  )
}
