import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'
import { Text } from '@/components/ui/Typography'

import styles from './prints.module.scss'
import { displayArtist, type PrintArtwork } from './types'

type Props = {
  artwork: PrintArtwork
}

const FALLBACK_WIDTH = 800
const FALLBACK_HEIGHT = 600

export const PrintCard = ({ artwork }: Props) => {
  const artist = displayArtist(artwork) || 'Unknown artist'
  const title = artwork.title || artwork.name
  const w = artwork.originalWidth ?? FALLBACK_WIDTH
  const h = artwork.originalHeight ?? FALLBACK_HEIGHT

  return (
    <div className={styles.card}>
      <div className={styles.imageWrapper}>
        {artwork.imageUrl ? (
          <Link href={`/artworks/${artwork.slug}`} className={styles.imageLink}>
            <ProtectedImage
              src={artwork.imageUrl}
              alt={title || 'Artwork'}
              className={styles.image}
              width={w}
              height={h}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </Link>
        ) : (
          <div className={styles.placeholder}>
            <Text as="span" size="sm">
              No image
            </Text>
          </div>
        )}
      </div>

      <div className={styles.info}>
        <Text as="h2" font="sans" size="md" className={styles.artist}>
          {artist}
        </Text>
        <Text as="h1" font="sans" size="lg" className={styles.title}>
          <em>{title}</em>
        </Text>
        {artwork.year && (
          <Text as="p" size="sm" className={styles.year}>
            {artwork.year}
          </Text>
        )}
        <div className={styles.action}>
          <Button
            href={`/artworks/${artwork.slug}/print`}
            label="Order Print"
            variant="primary"
            size="smallSquared"
          />
        </div>
      </div>
    </div>
  )
}
