'use client'

import { useEffect, useState } from 'react'

import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { ArtworkGrid } from '@/components/artwork/ArtworkGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'
import { RichText } from '@/components/ui/RichText'
import { NiceTitle } from '@/components/landing/NiceTitle/NiceTitle'
import { ExhibitionGrid } from '@/components/exhibitions/ExhibitionGrid'

import styles from './ArtistProfile.module.scss'

type Artist = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
  profileImageUrl: string | null
}

type Exhibition = {
  id: string
  mainTitle: string
  url: string
  handler: string
  featuredImageUrl?: string | null
  shortDescription?: string | null
}

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

interface ArtistProfilePageProps {
  slug: string
}

export const ArtistProfilePage = ({ slug }: ArtistProfilePageProps) => {
  const [artist, setArtist] = useState<Artist | null>(null)
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchArtist = async () => {
      try {
        const response = await fetch(`/api/artists/${slug}`)
        if (!response.ok) {
          setError('Artist not found')
          return
        }
        const data = await response.json()
        setArtist(data)

        // Fetch exhibitions and artworks in parallel
        const [exResponse, artResponse] = await Promise.all([
          fetch(`/api/exhibitions?userId=${data.id}&published=true`),
          fetch(`/api/artworks?userId=${data.id}&artworkType=image&featured=true`),
        ])

        if (exResponse.ok) {
          setExhibitions(await exResponse.json())
        }
        if (artResponse.ok) {
          setArtworks(await artResponse.json())
        }
      } catch (err) {
        console.error('Failed to fetch artist:', err)
        setError('Failed to load artist')
      } finally {
        setLoading(false)
      }
    }

    fetchArtist()
  }, [slug])

  if (loading) {
    return <PageLayout loading />
  }

  if (error || !artist) {
    return (
      <PageLayout>
        <Text as="p">{error || 'Artist not found'}</Text>
      </PageLayout>
    )
  }

  const artistFullName = `${artist.name} ${artist.lastName}`

  return (
    <PageLayout>
      <div className={styles.header}>
        <div>
          <Text as="h1" size="huge" className={styles.artistName}>
            {artist.name} {artist.lastName}
          </Text>
        </div>
        {artist.profileImageUrl ? (
          <div className={styles.avatarWrapper}>
            <ProtectedImage
              src={artist.profileImageUrl}
              alt={artistFullName}
              fill
              className={styles.avatar}
            />
          </div>
        ) : (
          <div className={styles.avatarPlaceholder}>
            {artist.name.charAt(0)}
            {artist.lastName.charAt(0)}
          </div>
        )}
      </div>

      <div className={styles.section}>
        {artist.biography ? (
          <RichText content={artist.biography} variant="compact" className={styles.biography} />
        ) : (
          <EmptyState message="No biography yet." />
        )}
      </div>

      {artworks.length > 0 && <NiceTitle title="Featured Works" align="left" />}

      {artworks.length > 0 && (
        <div className={styles.section}>
          <ArtworkGrid artworks={artworks} artistName={artistFullName} />
        </div>
      )}

      <NiceTitle title="Artist's Exhibitions" align="left" />
      <div className={styles.section}>
        {exhibitions.length === 0 ? (
          <EmptyState message="No exhibitions yet." />
        ) : (
          <ExhibitionGrid
            exhibitions={exhibitions.map((ex) => ({
              id: ex.id,
              mainTitle: ex.mainTitle,
              featuredImageUrl: ex.featuredImageUrl,
              shortDescription: ex.shortDescription,
              artistLabel: artistFullName,
              href: `/exhibitions/${artist.handler}/${ex.url}`,
            }))}
          />
        )}
      </div>
    </PageLayout>
  )
}
