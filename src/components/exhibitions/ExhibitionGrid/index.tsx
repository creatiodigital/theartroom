import Link from 'next/link'
import c from 'classnames'
import { ArrowRight } from 'lucide-react'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import { EnterVirtualLink } from '@/components/exhibitions/EnterVirtualLink'
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
  /** Straight into its 3D space, when that's published; null or absent for none. */
  visitHref?: string | null
}

interface ExhibitionGridProps {
  exhibitions: Exhibition[]
}

export const ExhibitionGrid = ({ exhibitions }: ExhibitionGridProps) => {
  return (
    <div className={styles.grid}>
      {exhibitions.map((exhibition) => (
        // The whole card opens the exhibition (its "Visit exhibition" link is stretched over it);
        // "Enter 3D room" is a link of its own on top, never inside that one.
        <div key={exhibition.id} className={styles.card}>
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
          <Link
            href={exhibition.href}
            className={c(styles.visitLink, styles.stretched)}
            aria-label={`Visit exhibition: ${exhibition.mainTitle}`}
          >
            <ArrowRight size={16} strokeWidth={ICON_STROKE_WIDTH} />
            <span>Visit exhibition</span>
          </Link>
          {exhibition.visitHref && (
            <EnterVirtualLink href={exhibition.visitHref} className={styles.enterLink} />
          )}
        </div>
      ))}
    </div>
  )
}
