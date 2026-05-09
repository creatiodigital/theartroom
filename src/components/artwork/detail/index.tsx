'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'

import { PageLayout } from '@/components/ui/PageLayout'
import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { InquireSidebar } from '@/components/ui/InquireSidebar'
import { Share } from '@/components/ui/Share'
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
  slug: string
  name: string
  title?: string | null
  author?: string | null
  year?: string | null
  technique?: string | null
  dimensions?: string | null
  description?: string | null
  imageUrl?: string | null
  originalWidth?: number | null
  originalHeight?: number | null
  printEnabled?: boolean | null
  printPriceCents?: number | null
}

interface ArtworkDetailPageProps {
  artwork: Artwork
  artist: Artist
}

const FALLBACK_WIDTH = 800
const FALLBACK_HEIGHT = 800

export const ArtworkDetailPage = ({ artwork, artist }: ArtworkDetailPageProps) => {
  const [isInternal, setIsInternal] = useState(false)

  useEffect(() => {
    try {
      const nav = sessionStorage.getItem('the-art-room:internal-nav')
      if (nav) {
        setIsInternal(true)
      }
    } catch {}
  }, [])
  const router = useRouter()
  const pathname = usePathname()
  const [isInquireOpen, setIsInquireOpen] = useState(false)

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${pathname}` : ''

  const handleClose = () => {
    try {
      sessionStorage.removeItem('the-art-room:internal-nav')
    } catch {}
    router.back()
  }

  const displayTitle = artwork.title || artwork.name || ''
  const displayAuthor = artwork.author || `${artist.name} ${artist.lastName}`
  const imgWidth = artwork.originalWidth ?? FALLBACK_WIDTH
  const imgHeight = artwork.originalHeight ?? FALLBACK_HEIGHT

  if (isInternal) {
    return (
      <>
        <div className={styles.page}>
          <header className={styles.minimalHeader}>
            <Logo className={styles.logo} />
            <Button
              variant="ghost"
              onClick={handleClose}
              label="CLOSE"
              iconRight={<Icon name="close" size={16} />}
              className={styles.closeButton}
              aria-label="Close artwork"
            />
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
                  <Text as="span" size="xl" font="serif" className={styles.titleText}>
                    {displayTitle}
                  </Text>
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
              {artwork.printEnabled && artwork.printPriceCents ? (
                <Button
                  variant="primary"
                  label="Buy Printable"
                  icon="arrowRight"
                  size="bigSquared"
                  onClick={() => router.push(`/artworks/${artwork.slug}/print`)}
                  className={styles.inquireButton}
                />
              ) : null}
              <Share title={displayTitle || 'Artwork'} url={shareUrl} className={styles.share} />
            </div>

            <div className={styles.imageContainer}>
              {artwork.imageUrl && (
                <Image
                  src={artwork.imageUrl}
                  alt={displayTitle || 'Artwork'}
                  width={imgWidth}
                  height={imgHeight}
                  className={styles.image}
                  priority
                  sizes="(max-width: 768px) 100vw, 60vw"
                />
              )}
            </div>
          </div>
        </div>

        <InquireSidebar
          isOpen={isInquireOpen}
          onClose={() => setIsInquireOpen(false)}
          artwork={{
            slug: artwork.slug,
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
  return (
    <>
      <PageLayout>
        <div className={styles.standaloneContent}>
          <div className={styles.metadata}>
            {displayAuthor && (
              <Text as="h1" size="2xl" className={styles.artistName}>
                {displayAuthor}
              </Text>
            )}
            {displayTitle && (
              <div className={styles.title}>
                <Text as="span" size="xl" font="serif" className={styles.titleText}>
                  {displayTitle}
                </Text>
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
            {artwork.printEnabled && artwork.printPriceCents ? (
              <Button
                variant="primary"
                label="Buy Printable"
                icon="arrowRight"
                size="bigSquared"
                onClick={() => router.push(`/artworks/${artwork.slug}/print`)}
                className={styles.inquireButton}
              />
            ) : null}
            <Share title={displayTitle || 'Artwork'} url={shareUrl} className={styles.share} />
          </div>

          <div className={styles.imageContainer}>
            {artwork.imageUrl && (
              <Image
                src={artwork.imageUrl}
                alt={displayTitle || 'Artwork'}
                width={imgWidth}
                height={imgHeight}
                className={styles.image}
                priority
                sizes="(max-width: 768px) 100vw, 60vw"
              />
            )}
          </div>
        </div>
      </PageLayout>

      <InquireSidebar
        isOpen={isInquireOpen}
        onClose={() => setIsInquireOpen(false)}
        artwork={{
          slug: artwork.slug,
          title: displayTitle || '',
          year: artwork.year ? parseInt(artwork.year) : undefined,
          artistName: displayAuthor || '',
          imageUrl: artwork.imageUrl || '',
        }}
      />
    </>
  )
}
