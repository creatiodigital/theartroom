'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { H1, H2 } from '@/components/ui/Typography'

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

interface ArtistProfilePageProps {
  slug: string
}

export const ArtistProfilePage = ({ slug }: ArtistProfilePageProps) => {
  const [artist, setArtist] = useState<Artist | null>(null)
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
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

        // Fetch public exhibitions for this artist
        const exResponse = await fetch(`/api/exhibitions?userId=${data.id}&visibility=public`)
        if (exResponse.ok) {
          const exData = await exResponse.json()
          setExhibitions(exData)
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
          <H1>Artist Profile</H1>
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
          <H1>Artist Profile</H1>
          <p>{error || 'Artist not found'}</p>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="page-content">
        <div className={styles.header}>
          {artist.profileImageUrl ? (
            <Image
              src={artist.profileImageUrl}
              alt={`${artist.name} ${artist.lastName}`}
              width={150}
              height={150}
              className={styles.avatar}
            />
          ) : (
            <div className={styles.avatarPlaceholder}>
              {artist.name.charAt(0)}
              {artist.lastName.charAt(0)}
            </div>
          )}
          <div>
            <H1 className={styles.artistName}>
              {artist.name} {artist.lastName}
            </H1>
            <p className={styles.handler}>@{artist.handler}</p>
          </div>
        </div>

        <div className={styles.section}>
          <H2>About</H2>
          {artist.biography ? (
            <div
              className={styles.biography}
              dangerouslySetInnerHTML={{ __html: artist.biography }}
            />
          ) : (
            <p className={styles.emptyText}>No biography yet.</p>
          )}
        </div>

        <div>
          <H2>Exhibitions</H2>
          {exhibitions.length === 0 ? (
            <p className={styles.emptyText}>No exhibitions yet.</p>
          ) : (
            <ul className={styles.exhibitionList}>
              {exhibitions.map((ex) => (
                <li key={ex.id} className={styles.exhibitionItem}>
                  <Link
                    href={`/exhibitions/${artist.handler}/${ex.url}`}
                    className={styles.exhibitionLink}
                  >
                    {ex.mainTitle} →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Footer />
    </>
  )
}
