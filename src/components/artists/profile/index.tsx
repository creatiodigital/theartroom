'use client'

import { useEffect, useState } from 'react'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

type Artist = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
}

interface ArtistProfilePageProps {
  slug: string
}

export const ArtistProfilePage = ({ slug }: ArtistProfilePageProps) => {
  const [artist, setArtist] = useState<Artist | null>(null)
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
        <div style={{ padding: '2rem', minHeight: '60vh' }}>
          <h1>Artist Profile</h1>
          <p>Loading...</p>
        </div>
        <Footer />
      </>
    )
  }

  if (error || !artist) {
    return (
      <>
        <Header />
        <div style={{ padding: '2rem', minHeight: '60vh' }}>
          <h1>Artist Profile</h1>
          <p>{error || 'Artist not found'}</p>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <div style={{ padding: '2rem', minHeight: '60vh' }}>
        <h1>{artist.name} {artist.lastName}</h1>
        <p>{artist.biography}</p>
      </div>
      <Footer />
    </>
  )
}
