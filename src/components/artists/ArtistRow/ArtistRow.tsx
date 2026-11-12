import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'

import { isSafeImageSrc } from '@/lib/imageSafety'
import { plainTextOf } from '@/lib/richText/headingAnchors'

import styles from './ArtistRow.module.scss'

export type ArtistRowData = {
  href: string
  name: string
  imageUrl: string | null
  /** The bio (rich text); its opening lines, clamped. */
  biography: string | null
  /** The Artists page: their exhibitions, joined by " · ". */
  exhibitions?: string[]
}

/**
 * One artist in a row (docs/public-redesign/artists.md; the exhibition page's "About the artist"):
 * a 3:2 portrait, the name in serif, the bio's opening lines, "→ View artist". The whole row is one
 * link to the artist page.
 */
export const ArtistRow = ({ artist }: { artist: ArtistRowData }) => {
  const bio = artist.biography ? plainTextOf(artist.biography) : ''
  return (
    <Link href={artist.href} className={styles.row}>
      <span className={styles.portrait}>
        {artist.imageUrl && isSafeImageSrc(artist.imageUrl) && (
          <Image
            src={artist.imageUrl}
            alt=""
            fill
            // Skip the Vercel optimizer: source is already-optimized .webp on an
            // immutable R2/CDN; cold re-encodes broke images on first load (AR-125).
            unoptimized
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
        {bio && <span className={styles.bio}>{bio}</span>}
      </span>
      <span className={styles.view}>
        <ArrowRight size={18} weight="light" aria-hidden />
        View artist
      </span>
    </Link>
  )
}
