'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

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
          <h1 className={styles.title}>Artists</h1>
          <p>Loading...</p>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <div className={styles.page}>
        <h1 className={styles.title}>Artists</h1>
        {artists.length === 0 ? (
          <p className={styles.empty}>No artists found.</p>
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
