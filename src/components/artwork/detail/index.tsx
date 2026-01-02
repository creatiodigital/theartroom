'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Text } from '@/components/ui/Typography'

import styles from './ArtworkDetail.module.scss'

type Artist = {
  id: string
  name: string
  lastName: string
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
  description?: string
  imageUrl?: string
}

interface ArtworkDetailPageProps {
  artworkId: string
  isInternal: boolean
}

export const ArtworkDetailPage = ({
  artworkId,
  isInternal,
}: ArtworkDetailPageProps) => {
  const router = useRouter()
  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [artist, setArtist] = useState<Artist | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/artworks/${artworkId}/detail`)
        if (!response.ok) {
          setError('Artwork not found')
          return
        }
        const data = await response.json()
        setArtwork(data.artwork)
        setArtist(data.artist)
      } catch (err) {
        console.error('Failed to fetch artwork:', err)
        setError('Failed to load artwork')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [artworkId])

  const handleClose = () => {
    router.back()
  }

  // Loading state
  if (loading) {
    if (isInternal) {
      return (
        <div className={styles.page}>
          <header className={styles.minimalHeader}>
            <Link href="/" className={styles.logo}>
              <Text as="h2" className={styles.logoText}>Lumen Gallery</Text>
            </Link>
          </header>
          <div className={styles.content}>
            <LoadingBar />
          </div>
        </div>
      )
    }
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

  // Error state
  if (error || !artwork) {
    if (isInternal) {
      return (
        <div className={styles.page}>
          <header className={styles.minimalHeader}>
            <Link href="/" className={styles.logo}>
              <Text as="h2" className={styles.logoText}>Lumen Gallery</Text>
            </Link>
            <button onClick={handleClose} className={styles.closeButton}>
              CLOSE <span className={styles.closeIcon}>×</span>
            </button>
          </header>
          <div className={styles.content}>
            <Text as="p">{error || 'Artwork not found'}</Text>
          </div>
        </div>
      )
    }
    return (
      <>
        <Header />
        <div className="page-content">
          <Text as="p">{error || 'Artwork not found'}</Text>
        </div>
        <Footer />
      </>
    )
  }

  const displayTitle = artwork.title || artwork.name
  const displayAuthor = artwork.author || (artist ? `${artist.name} ${artist.lastName}` : '')

  // Internal mode - minimal header with close button
  if (isInternal) {
    return (
      <div className={styles.page}>
        <header className={styles.minimalHeader}>
          <Link href="/" className={styles.logo}>
            <Text as="h2" className={styles.logoText}>Lumen Gallery</Text>
          </Link>
          <button onClick={handleClose} className={styles.closeButton}>
            CLOSE <span className={styles.closeIcon}>×</span>
          </button>
        </header>

        <div className={styles.content}>
          <div className={styles.metadata}>
            {displayAuthor && (
              <Text as="h2" className={styles.artistName}>{displayAuthor}</Text>
            )}
            {displayTitle && (
              <Text as="p" font="serif" className={styles.title}>
                <em>{displayTitle}</em>
                {artwork.year && <span>, {artwork.year}</span>}
              </Text>
            )}
            {artwork.technique && (
              <Text as="p" size="sm" className={styles.technique}>{artwork.technique}</Text>
            )}
            {artwork.dimensions && (
              <Text as="p" size="sm" className={styles.dimensions}>{artwork.dimensions}</Text>
            )}
            {artwork.description && (
              <Text as="p" size="sm" className={styles.description}>{artwork.description}</Text>
            )}
          </div>

          <div className={styles.imageContainer}>
            {artwork.imageUrl && (
              <img
                src={artwork.imageUrl}
                alt={displayTitle || 'Artwork'}
                className={styles.image}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  // Standalone mode - full header and footer
  return (
    <>
      <Header />
      <div className="page-content">
        <div className={styles.standaloneContent}>
          <div className={styles.metadata}>
            {displayAuthor && (
              <Text as="h2" className={styles.artistName}>{displayAuthor}</Text>
            )}
            {displayTitle && (
              <Text as="p" font="serif" className={styles.title}>
                <em>{displayTitle}</em>
                {artwork.year && <span>, {artwork.year}</span>}
              </Text>
            )}
            {artwork.technique && (
              <Text as="p" size="sm" className={styles.technique}>{artwork.technique}</Text>
            )}
            {artwork.dimensions && (
              <Text as="p" size="sm" className={styles.dimensions}>{artwork.dimensions}</Text>
            )}
            {artwork.description && (
              <Text as="p" size="sm" className={styles.description}>{artwork.description}</Text>
            )}
          </div>

          <div className={styles.imageContainer}>
            {artwork.imageUrl && (
              <img
                src={artwork.imageUrl}
                alt={displayTitle || 'Artwork'}
                className={styles.image}
              />
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
