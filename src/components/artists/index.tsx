'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { EmptyState } from '@/components/ui/EmptyState'
import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'

import styles from './artists.module.scss'

type Artist = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
  profileImageUrl?: string
}

export const ArtistsPage = () => {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const response = await fetch('/api/artists')
        const data = await response.json()
        setArtists(data)
      } catch (error) {
        console.error('Failed to fetch artists:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchArtists()
  }, [])

  return (
    <PageLayout loading={loading}>
      {artists.length === 0 ? (
        <EmptyState message="No artists found." />
      ) : (
        <>
          <div className={styles.pageHeader}>
            <Text as="h1" font="serif" size="3xl" className={styles.pageTitle}>Artists</Text>
            <Text as="p" size="sm" className={styles.pageSubtitle}>
              Artists in current and past exhibitions
            </Text>
          </div>
          <ul className={styles.list}>
            {artists.map((artist, index) => (
              <li key={artist.id}>
                <Link href={`/artists/${artist.handler}`} className={styles.artistRow}>
                  <div className={styles.artistInfo}>
                    <span className={styles.index}>
                      ({String(index + 1).padStart(2, '0')})
                    </span>
                    <span className={styles.artistName}>
                      {artist.name} {artist.lastName}
                    </span>
                  </div>
                  {artist.profileImageUrl && (
                    <div className={styles.imageContainer}>
                      <Image
                        src={artist.profileImageUrl}
                        alt={`${artist.name} ${artist.lastName}`}
                        width={200}
                        height={140}
                        className={styles.featuredImage}
                      />
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageLayout>
  )
}
