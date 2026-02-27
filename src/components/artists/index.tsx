'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'

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
          <PageHeader
            pageTitle="Artists"
            pageSubtitle="Participants in current and past exhibitions."
          />
          <ul className={styles.list}>
            {artists.map((artist, index) => (
              <li key={artist.id}>
                <Link href={`/artists/${artist.handler}`} className={styles.artistRow}>
                  <div className={styles.artistInfo}>
                    <span className={styles.index}>({String(index + 1).padStart(2, '0')})</span>
                    <span className={styles.artistName}>
                      {artist.name} {artist.lastName}
                    </span>
                  </div>
                  {artist.profileImageUrl && (
                    <div className={styles.imageContainer}>
                      <ProtectedImage
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
