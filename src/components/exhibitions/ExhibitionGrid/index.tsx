import Link from 'next/link'
import Image from 'next/image'

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
              <Image
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
          <Text as="span" size="xs" className={styles.label}>
            {exhibition.artistLabel}
          </Text>
          <Text as="span" font="serif" size="2xl" className={styles.title}>
            {exhibition.mainTitle}
          </Text>
          {exhibition.shortDescription && (
            <Text as="p" size="sm" className={styles.description}>
              {exhibition.shortDescription}
            </Text>
          )}
        </Link>
      ))}
    </div>
  )
}
