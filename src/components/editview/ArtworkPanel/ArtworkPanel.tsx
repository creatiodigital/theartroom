'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useRouter } from 'next/navigation'

import { X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { RichText } from '@/components/ui/RichText'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { getCameraState } from '@/components/scene/controls/MainCamera/MainCamera'
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

  const { name, artworkTitle, artworkYear, artworkDimensions, imageUrl } = selectedArtwork || {}

  // Use original URLs - Next.js image optimization has issues with R2 URLs in production
  const thumbnailUrl = imageUrl || null

  const handleViewDetails = () => {
    if (!selectedArtwork?.id) return
    // Save the actual camera position so we can restore it on return
    const cameraState = getCameraState()
    if (cameraState) {
      try {
        sessionStorage.setItem('the-art-room:camera-state', JSON.stringify(cameraState))
      } catch {
        // sessionStorage not available, ignore
      }
    }
    try {
      sessionStorage.setItem('the-art-room:internal-nav', JSON.stringify({ from: 'exhibition' }))
    } catch {}
    router.push(`/artworks/${selectedArtwork.slug}`)
  }

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      data-panel-overlay
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        onClick={() => dispatch(hideArtworkPanel())}
        className={styles.closeButton}
        aria-label="Close"
      >
        CLOSE <X size={14} strokeWidth={ICON_STROKE_WIDTH} />
      </Button>
      <div className={styles.header}>
        {thumbnailUrl && (
          <div className={styles.imageWrapper}>
            <img
              src={thumbnailUrl}
              alt={artworkTitle || name || 'Artwork'}
              className={styles.preview}
            />
          </div>
        )}
        <div className={styles.info}>
          {selectedArtwork && (
            <div>
              {selectedArtwork.author && (
                <Text font="serif" as="h1" size="2xl" className={styles.author}>
                  {selectedArtwork.author}
                </Text>
              )}
              {(artworkTitle || name) && (
                <div className={styles.titleWrapper}>
                  <Text font="serif" as="span" size="xl" className={styles.title}>
                    {artworkTitle || name},{' '}
                  </Text>
                  <Text font="serif" as="span" size="xl" className={styles.year}>
                    {artworkYear && `${artworkYear}`}
                  </Text>
                </div>
              )}
              {selectedArtwork.technique && (
                <RichText
                  content={selectedArtwork.technique}
                  variant="compact"
                  className={styles.technique}
                />
              )}
              {artworkDimensions && (
                <Text font="dashboard" as="p" size="sm" className={styles.dimensions}>
                  {artworkDimensions}
                </Text>
              )}
            </div>
          )}
        </div>
        <Button
          variant="primary"
          size="regularSquared"
          label="View Details"
          icon="arrowRight"
          onClick={handleViewDetails}
        />
      </div>
    </div>
  )
}

export default ArtworkPanel
