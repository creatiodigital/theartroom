'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { hideArtworkPanel } from '@/redux/slices/dashboardSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import styles from './ArtworkPanel.module.scss'

const ArtworkPanel = () => {
  const dispatch = useDispatch()
  const router = useRouter()
  const panelRef = useRef(null)
  const selectedSceneArtworkId = useSelector((state: RootState) => state.scene.currentArtworkId)
  const byId = useSelector((state: RootState) => state.artworks.byId)

  const selectedArtwork: TArtwork = useMemo(
    () => byId[selectedSceneArtworkId ?? ''],
    [byId, selectedSceneArtworkId],
  )

  // Auto-hide panel when no artwork is selected (e.g., after back navigation)
  useEffect(() => {
    if (!selectedSceneArtworkId || !selectedArtwork) {
      dispatch(hideArtworkPanel())
    }
  }, [selectedSceneArtworkId, selectedArtwork, dispatch])

  const { name, artworkTitle, author, artworkYear, description, artworkDimensions, imageUrl } =
    selectedArtwork || {}

  // Use original URLs - Next.js image optimization has issues with Vercel Blob URLs in production
  const thumbnailUrl = imageUrl || null

  const handleViewDetails = () => {
    if (!selectedArtwork?.id) return
    router.push(`/artworks/${selectedArtwork.id}?ref=internal`)
  }

  return (
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
          <Button variant="primary" label="View Details" onClick={handleViewDetails} />
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
              <Text as="span" size="md" font="serif" className={styles.title}>{artworkTitle || name}</Text>
            )}
            {artworkYear && <Text as="span" size="md" font="serif" className={styles.year}>{`, ${artworkYear}`}</Text>}
            {description && <Text as="div" size="md" font="serif" className={styles.description}>{description}</Text>}
            {artworkDimensions && <Text as="span" size="md" font="serif" className={styles.dimensions}>{artworkDimensions}</Text>}
          </div>
        )}
      </div>

      <div className={styles.cta}>
        <Button variant="outline" label="Close" onClick={() => dispatch(hideArtworkPanel())} />
      </div>
    </div>
  )
}

export default ArtworkPanel
