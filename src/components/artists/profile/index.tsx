'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { ArtworkGrid } from '@/components/artwork/ArtworkGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Text } from '@/components/ui/Typography'
import { RichText } from '@/components/ui/RichText'

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
}

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
          fetch(`/api/exhibitions?userId=${data.id}&visibility=public`),
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
    return (
      <>
        <Header />
        <div className="page-content">
          <LoadingBar />
        </div>
        <Footer />
      </>
    )
  }

  if (error || !artist) {
    return (
      <>
        <Header />
        <div className="page-content">
          <Text as="p">{error || 'Artist not found'}</Text>
        </div>
        <Footer />
      </>
    )
  }

  const artistFullName = `${artist.name} ${artist.lastName}`

  return (
    <>
      <Header />
      <div className="page-content">
        <div className={styles.header}>
          <div>
            <Text as="h2" className={styles.artistName}>{artist.name}</Text>
            <Text as="h2" className={styles.artistName}>{artist.lastName}</Text>
          </div>
          {artist.profileImageUrl ? (
            <div className={styles.avatarWrapper}>
              <Image
                src={artist.profileImageUrl}
                alt={artistFullName}
                fill
                className={styles.avatar}
              />
            </div>
          ) : (
            <div className={styles.avatarPlaceholder}>
              {artist.name.charAt(0)}{artist.lastName.charAt(0)}
            </div>
          )}
        </div>

        <div className={styles.section}>
          {artist.biography ? (
            <RichText content={artist.biography} className={styles.biography} />
          ) : (
            <EmptyState message="No biography yet." />
          )}
        </div>

        <div className={styles.section}>
          <Text as="h2" className={styles.sectionHeading}>Exhibitions</Text>
          {exhibitions.length === 0 ? (
            <EmptyState message="No exhibitions yet." />
          ) : (
            <ul className={styles.exhibitionList}>
              {exhibitions.map((ex) => (
                <li key={ex.id} className={styles.exhibitionItem}>
                  <Link href={`/exhibitions/${artist.handler}/${ex.url}`} className={styles.exhibitionLink}>
                    <Text as="span" font="serif" size="4xl">{ex.mainTitle}</Text>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {artworks.length > 0 && (
          <div className={styles.section}>
            <Text as="h2" className={styles.sectionHeading}>Selected Works</Text>
            <ArtworkGrid artworks={artworks} artistName={artistFullName} />
          </div>
        )}
      </div>
      <Footer />
    </>
  )
}
