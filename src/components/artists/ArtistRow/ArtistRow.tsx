import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'

import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'
import { isSafeImageSrc } from '@/lib/imageSafety'
import c from 'classnames'

import styles from './ArtistRow.module.scss'

export type ArtistRowData = {
  href: string
  name: string
  imageUrl: string | null
  /** The Artists page: their exhibitions, joined by " · " (wrapping, never cut). */
  exhibitions?: string[]
}

/**
 * One artist in a row (docs/public-redesign/artists.md): a 3:2 portrait, the name in serif, their
 * exhibitions, "→ View artist". The whole row is one link to the artist page.
 */
export const ArtistRow = ({ artist, className }: { artist: ArtistRowData; className?: string }) => {
  return (
    <Link href={artist.href} className={c(styles.row, className)}>
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
      </span>
      <span className={styles.view}>
        <ArrowRight size={18} weight="light" aria-hidden />
        View artist
      </span>
    </Link>
  )
}
