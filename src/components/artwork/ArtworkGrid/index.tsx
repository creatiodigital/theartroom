'use client'

import Link from 'next/link'

import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'

import styles from './ArtworkGrid.module.scss'

type Artwork = {
  id: string
  slug: string
  name: string
  title?: string
  author?: string
  year?: string
  technique?: string
  dimensions?: string
  imageUrl?: string
}

interface ArtworkGridProps {
  artworks: Artwork[]
  artistName?: string
}

export const ArtworkGrid = ({ artworks, artistName }: ArtworkGridProps) => {
  return (
    <div className={styles.grid}>
      {artworks.map((artwork) => (
        <div key={artwork.id} className={styles.card}>
          <div className={styles.imageWrapper}>
            {artwork.imageUrl ? (
              <Link href={`/artworks/${artwork.slug}`} className={styles.viewDetailsLink}>
                <ProtectedImage
                  src={artwork.imageUrl}
                  alt={artwork.title || artwork.name || 'Artwork'}
                  className={styles.image}
                  width={600}
                  height={600}
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
              {artwork.author || artistName || ''}
            </Text>
            <Text as="h1" font="sans" size="lg" className={styles.title}>
              <em>{artwork.title || artwork.name}</em>
              {artwork.year && <span>, {artwork.year}</span>}
            </Text>
            {artwork.technique && (
              <RichText content={artwork.technique} variant="compact" className={styles.detail} />
            )}
            {artwork.dimensions && (
              <Text as="p" size="sm" className={styles.detail}>
                {artwork.dimensions}
              </Text>
            )}
            {/* <Link href={`/artworks/${artwork.id}?ref=internal`} className={styles.viewDetailsLink}>
              <Button size="small" variant="secondary" label="Inquire" />
            </Link> */}
          </div>
        </div>
      ))}
    </div>
  )
}
