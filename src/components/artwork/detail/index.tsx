'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { PageLayout } from '@/components/ui/PageLayout'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'
import { ImageMagnifier } from '@/components/ui/ImageMagnifier'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { InquireSidebar } from '@/components/ui/InquireSidebar'
import { isRichTextEmpty } from '@/lib/textUtils'
import Logo from '@/icons/logo.svg'

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

export const ArtworkDetailPage = ({ artworkId, isInternal }: ArtworkDetailPageProps) => {
  const router = useRouter()
  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [artist, setArtist] = useState<Artist | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInquireOpen, setIsInquireOpen] = useState(false)

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

  const displayTitle = artwork?.title || artwork?.name || ''
  const displayAuthor = artwork?.author || (artist ? `${artist.name} ${artist.lastName}` : '')

  if (isInternal) {
    if (loading) {
      return (
        <div className={styles.page}>
          <header className={styles.minimalHeader}>
            <Logo className={styles.logo} />
            <button onClick={handleClose} className={styles.closeButton}>
              CLOSE{' '}
              <span className={styles.closeIcon}>
                <Icon name="close" size={16} />
              </span>
            </button>
          </header>
          <div className={styles.content}>
            <LoadingBar />
          </div>
        </div>
      )
    }

    if (error || !artwork) {
      return (
        <div className={styles.page}>
          <header className={styles.minimalHeader}>
            <Logo className={styles.logo} />
            <button onClick={handleClose} className={styles.closeButton}>
              CLOSE{' '}
              <span className={styles.closeIcon}>
                <Icon name="close" size={16} />
              </span>
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
        <div className={styles.page}>
          <header className={styles.minimalHeader}>
            <Logo className={styles.logo} />
            <button onClick={handleClose} className={styles.closeButton}>
              CLOSE{' '}
              <span className={styles.closeIcon}>
                <Icon name="close" size={16} />
              </span>
            </button>
          </header>

          <div className={styles.content}>
            <div className={styles.metadata}>
              {displayAuthor && (
                <Text as="h1" size="2xl" className={styles.artistName}>
                  {displayAuthor}
                </Text>
              )}
              {displayTitle && (
                <div className={styles.title}>
                  {displayTitle && (
                    <Text as="span" size="xl" font="serif" className={styles.titleText}>
                      {displayTitle}
                    </Text>
                  )}
                  {artwork.year && (
                    <Text as="span" size="xl" font="serif" className={styles.year}>
                      , {artwork.year}
                    </Text>
                  )}
                </div>
              )}
              {artwork.technique && (
                <RichText
                  content={artwork.technique}
                  variant="compact"
                  className={styles.technique}
                />
              )}
              {artwork.dimensions && (
                <Text as="p" size="sm" className={styles.dimensions}>
                  {artwork.dimensions}
                </Text>
              )}
              {!isRichTextEmpty(artwork.description) && (
                <RichText
                  content={artwork.description!}
                  variant="compact"
                  className={styles.description}
                />
              )}
              <Button
                variant="secondary"
                label="Inquire"
                icon="arrowRight"
                size="bigSquared"
                onClick={() => setIsInquireOpen(true)}
                className={styles.inquireButton}
              />
            </div>

            <div className={styles.imageContainer}>
              {artwork.imageUrl && (
                <ImageMagnifier src={artwork.imageUrl} alt={displayTitle || 'Artwork'} />
              )}
            </div>
          </div>
        </div>

        <InquireSidebar
          isOpen={isInquireOpen}
          onClose={() => setIsInquireOpen(false)}
          artwork={{
            id: artwork.id,
            title: displayTitle || '',
            year: artwork.year ? parseInt(artwork.year) : undefined,
            artistName: displayAuthor || '',
            imageUrl: artwork.imageUrl || '',
          }}
        />
      </>
    )
  }

  // Standalone mode - use PageLayout
  if (loading) {
    return <PageLayout loading />
  }

  if (error || !artwork) {
    return (
      <PageLayout>
        <Text as="p">{error || 'Artwork not found'}</Text>
      </PageLayout>
    )
  }

  return (
    <>
      <PageLayout>
        <div className={styles.standaloneContent}>
          <div className={styles.metadata}>
            {displayAuthor && (
              <Text as="h2" className={styles.artistName}>
                {displayAuthor}
              </Text>
            )}
            {displayTitle && (
              <div className={styles.title}>
                <Text as="span" font="serif" className={styles.titleText}>
                  {displayTitle}
                </Text>
                {artwork.year && (
                  <Text as="span" font="serif" className={styles.year}>
                    , {artwork.year}
                  </Text>
                )}
              </div>
            )}
            {artwork.technique && (
              <RichText
                content={artwork.technique}
                variant="compact"
                className={styles.technique}
              />
            )}
            {artwork.dimensions && (
              <Text as="p" size="sm" className={styles.dimensions}>
                {artwork.dimensions}
              </Text>
            )}
            {!isRichTextEmpty(artwork.description) && (
              <RichText
                content={artwork.description!}
                variant="compact"
                className={styles.description}
              />
            )}
            <Button
              variant="secondary"
              label="Inquire"
              icon="arrowRight"
              size="bigSquared"
              onClick={() => setIsInquireOpen(true)}
              className={styles.inquireButton}
            />
          </div>

          <div className={styles.imageContainer}>
            {artwork.imageUrl && (
              <ImageMagnifier src={artwork.imageUrl} alt={displayTitle || 'Artwork'} />
            )}
          </div>
        </div>
      </PageLayout>

      <InquireSidebar
        isOpen={isInquireOpen}
        onClose={() => setIsInquireOpen(false)}
        artwork={{
          id: artwork.id,
          title: displayTitle || '',
          year: artwork.year ? parseInt(artwork.year) : undefined,
          artistName: displayAuthor || '',
          imageUrl: artwork.imageUrl || '',
        }}
      />
    </>
  )
}
