import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

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
}

interface ExhibitionGridProps {
  exhibitions: Exhibition[]
}

export const ExhibitionGrid = ({ exhibitions }: ExhibitionGridProps) => {
  return (
    <div className={styles.grid}>
      {exhibitions.map((exhibition) => (
        <Link key={exhibition.id} href={exhibition.href} className={styles.card}>
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
          <span className={styles.visitLink}>
            <ArrowRight size={16} strokeWidth={ICON_STROKE_WIDTH} />
            <span>Visit exhibition</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
