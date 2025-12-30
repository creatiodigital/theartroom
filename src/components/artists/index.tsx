'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { EmptyState } from '@/components/ui/EmptyState'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { H1 } from '@/components/ui/Typography'

import styles from './artists.module.scss'

type Artist = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
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

  if (loading) {
    return (
      <>
        <Header />
        <div className={styles.page}>
          <H1 className={styles.title}>Artists</H1>
          <LoadingBar />
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <div className={styles.page}>
        <H1 className={styles.title}>Artists</H1>
        {artists.length === 0 ? (
          <EmptyState message="No artists found." />
        ) : (
          <ul className={styles.list}>
            {artists.map((artist) => (
              <li key={artist.id}>
                <Link href={`/artists/${artist.handler}`} className={styles.artistLink}>
                  {artist.name} {artist.lastName}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Footer />
    </>
  )
}
