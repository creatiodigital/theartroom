'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

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
      <div style={{ padding: '2rem', minHeight: '60vh', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem' }}>
          {artist.profileImageUrl ? (
            <Image
              src={artist.profileImageUrl}
              alt={`${artist.name} ${artist.lastName}`}
              width={150}
              height={150}
              style={{ borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: '50%',
                backgroundColor: '#eee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '3rem',
                color: '#999',
              }}
            >
              {artist.name.charAt(0)}
              {artist.lastName.charAt(0)}
            </div>
          )}
          <div>
            <h1 style={{ margin: 0 }}>
              {artist.name} {artist.lastName}
            </h1>
            <p style={{ color: '#666', margin: '0.5rem 0 0' }}>@{artist.handler}</p>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2>About</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{artist.biography || 'No biography yet.'}</p>
        </div>

        <div>
          <h2>Exhibitions</h2>
          {exhibitions.length === 0 ? (
            <p style={{ color: '#666' }}>No exhibitions yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {exhibitions.map((ex) => (
                <li key={ex.id} style={{ marginBottom: '0.75rem' }}>
                  <Link
                    href={`/exhibitions/${artist.handler}/${ex.url}`}
                    style={{
                      color: '#333',
                      textDecoration: 'none',
                      fontSize: '1.1rem',
                      display: 'inline-block',
                      padding: '0.5rem 0',
                      borderBottom: '1px solid #eee',
                      width: '100%',
                    }}
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
