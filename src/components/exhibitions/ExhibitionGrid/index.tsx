import Link from 'next/link'

import { ExhibitionActions } from '@/components/exhibitions/ExhibitionActions'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { Text } from '@/components/ui/Typography'

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

export const ExhibitionGrid = ({ exhibitions }: ExhibitionGridProps) => {
  return (
    <div className={styles.grid}>
      {exhibitions.map((exhibition) => (
        // Two links side by side, never one inside the other: the card's picture and text open the
        // exhibition page, and the line under them offers the page or the 3D room.
        <div key={exhibition.id} className={styles.card}>
          <Link href={exhibition.href} className={styles.cardLink}>
            <div className={styles.imageWrapper}>
              {exhibition.featuredImageUrl ? (
                <ProtectedImage
                  src={exhibition.featuredImageUrl}
                  alt={exhibition.mainTitle}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className={styles.image}
                />
              ) : (
                <div className={styles.imagePlaceholder} />
              )}
            </div>
            <Text as="h2" size="xl" className={styles.author}>
              {exhibition.artistLabel}
            </Text>
            <Text as="h1" font="serif" size="2xl" className={styles.title}>
              {exhibition.mainTitle}
            </Text>
            {exhibition.shortDescription && (
              <Text as="p" size="sm" className={styles.description}>
                {exhibition.shortDescription}
              </Text>
            )}
          </Link>
          <ExhibitionActions
            href={exhibition.href}
            visitUrl={exhibition.visitUrl}
            className={styles.actions}
          />
        </div>
      ))}
    </div>
  )
}
