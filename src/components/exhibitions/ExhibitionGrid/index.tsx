import Link from 'next/link'

import { ExhibitionActions } from '@/components/exhibitions/ExhibitionActions'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import styles from './ExhibitionGrid.module.scss'

type Exhibition = {
  id: string
  mainTitle: string
  featuredImageUrl?: string | null
  shortDescription?: string | null
  artistLabel: string
  href: string
  /** Straight into the exhibition's 3D room, when its space is published; else no such link. */
  visitUrl?: string | null
}

interface ExhibitionGridProps {
  exhibitions: Exhibition[]
}

/**
 * The homepage's Current exhibitions (docs/public-redesign/home.md §3): two columns (one on
 * phones), a 4:3 picture with nothing on it, the artist in small caps, the serif title, the
 * description on three lines, then "→ View exhibition | Enter 3D room".
 */
export const ExhibitionGrid = ({ exhibitions }: ExhibitionGridProps) => {
  return (
    <div className={styles.grid}>
      {exhibitions.map((exhibition) => (
        // Two links side by side, never one inside the other: the card's picture and text open the
        // exhibition page, and the line under them offers the page or the 3D room.
        <article key={exhibition.id} className={styles.card}>
          <Link href={exhibition.href} className={styles.cardLink}>
            <div className={styles.imageWrapper}>
              {exhibition.featuredImageUrl ? (
                <ProtectedImage
                  src={exhibition.featuredImageUrl}
                  alt={exhibition.mainTitle}
                  fill
                  sizes="(max-width: 768px) 100vw, 580px"
                  className={styles.image}
                />
              ) : (
                <div className={styles.imagePlaceholder} />
              )}
            </div>
            <span className={styles.author}>{exhibition.artistLabel}</span>
            <h3 className={styles.title}>{exhibition.mainTitle}</h3>
            {exhibition.shortDescription && (
              <p className={styles.description}>{exhibition.shortDescription}</p>
            )}
          </Link>
          <ExhibitionActions
            href={exhibition.href}
            visitUrl={exhibition.visitUrl}
            className={styles.actions}
          />
        </article>
      ))}
    </div>
  )
}
