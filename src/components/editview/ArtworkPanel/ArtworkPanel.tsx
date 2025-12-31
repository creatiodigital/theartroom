'use client'

import { useRef, useMemo, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { Text } from '@/components/ui/Typography'
import { hideArtworkPanel } from '@/redux/slices/dashboardSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import styles from './ArtworkPanel.module.scss'

const ArtworkPanel = () => {
  const dispatch = useDispatch()
  const panelRef = useRef(null)
  const selectedSceneArtworkId = useSelector((state: RootState) => state.scene.currentArtworkId)
  const byId = useSelector((state: RootState) => state.artworks.byId)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  const selectedArtwork: TArtwork = useMemo(
    () => byId[selectedSceneArtworkId ?? ''],
    [byId, selectedSceneArtworkId],
  )

  const { name, artworkTitle, author, artworkYear, description, artworkDimensions, imageUrl } =
    selectedArtwork || {}

  // Use original URLs - Next.js image optimization has issues with Vercel Blob URLs in production
  const thumbnailUrl = imageUrl || null
  const highResUrl = imageUrl || null

  return (
    <>
      <div ref={panelRef} className={styles.panel}>
        {/* Image Preview Section */}
        {thumbnailUrl && (
          <div className={styles.imageSection}>
            <div className={styles.imageWrapper}>
              <img
                src={thumbnailUrl}
                alt={artworkTitle || name || 'Artwork'}
                className={styles.preview}
              />
            </div>
            <Button variant="primary" label="View Image" onClick={() => setIsLightboxOpen(true)} />
          </div>
        )}

        {/* Artwork Info Section */}
        <div className={styles.info}>
          {selectedArtwork && (
            <div>
              {author && (
                <Text as="h3" className={styles.author}>
                  {author}
                </Text>
              )}
              {(artworkTitle || name) && (
                <span className={styles.title}>{artworkTitle || name}</span>
              )}
              {artworkYear && <span className={styles.year}>{`, ${artworkYear}`}</span>}
              {description && <div className={styles.description}>{description}</div>}
              {artworkDimensions && <span className={styles.dimensions}>{artworkDimensions}</span>}
            </div>
          )}
        </div>

        <div className={styles.cta}>
          <Button variant="outline" label="Close" onClick={() => dispatch(hideArtworkPanel())} />
        </div>
      </div>

      {/* Lightbox for high-res view */}
      {isLightboxOpen && highResUrl && (
        <ImageLightbox
          imageUrl={highResUrl}
          alt={artworkTitle || name || 'Artwork'}
          caption={artworkTitle || name}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </>
  )
}

export default ArtworkPanel
