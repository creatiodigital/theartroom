'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'

import styles from './ArtworkGrid.module.scss'

type Artwork = {
  id: string
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
              <Link
                href={`/artworks/${artwork.id}?ref=internal`}
                className={styles.viewDetailsLink}
              >
                <img
                  src={artwork.imageUrl}
                  alt={artwork.title || artwork.name || 'Artwork'}
                  className={styles.image}
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
            <Text as="p" className={styles.artist}>
              {artwork.author || artistName || ''}
            </Text>
            <Text as="p" font="sans" className={styles.title}>
              <em>{artwork.title || artwork.name}</em>
              {artwork.year && <span>, {artwork.year}</span>}
            </Text>
            {artwork.technique && (
              <Text as="p" size="sm" className={styles.detail}>
                {artwork.technique}
              </Text>
            )}
            {artwork.dimensions && (
              <Text as="p" size="sm" className={styles.detail}>
                {artwork.dimensions}
              </Text>
            )}
            {/* <Link href={`/artworks/${artwork.id}?ref=internal`} className={styles.viewDetailsLink}>
              <Button size="small" variant="outline" label="Inquire" />
            </Link> */}
          </div>
        </div>
      ))}
    </div>
  )
}
