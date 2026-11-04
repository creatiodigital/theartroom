'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { X } from 'lucide-react'

import { PrintPresentation } from '@/components/printPresentation/PrintPresentation'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { RichText } from '@/components/ui/RichText'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { hideArtworkPanel, openArtworkModal } from '@/redux/slices/dashboardSlice'
import type { PresentationView } from '@/lib/printPresentation/record'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import styles from './ArtworkPanel.module.scss'

interface ArtworkPanelProps {
  /**
   * The work as a photo of the print, as the grids show it (AR-174): the 3D room passes it for the
   * open work when it has a current render. Without one (or in the editor), the plain image.
   */
  presentation?: PresentationView | null
}

const ArtworkPanel = ({ presentation }: ArtworkPanelProps) => {
  const dispatch = useDispatch()
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

  const { name, artworkTitle, artworkDimensions, imageUrl } = selectedArtwork || {}

  // Use original URLs - Next.js image optimization has issues with R2 URLs in production
  const thumbnailUrl = imageUrl || null

  const handleViewDetails = () => {
    if (!selectedArtwork?.id) return
    // Open the in-exhibition modal over the live scene and close the sidebar beneath it,
    // so dismissing the modal returns to a clean scene with no sidebar lingering.
    dispatch(hideArtworkPanel())
    dispatch(openArtworkModal())
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
            {/* Cropped to the piece and a thin border of wall, as the artwork page does, so it
                is as large as the panel allows. */}
            <PrintPresentation
              view={presentation}
              size="large"
              crop
              className={styles.presentation}
              renderClassName={styles.presentationRender}
            >
              {(placement) => (
                <img
                  src={thumbnailUrl}
                  alt={artworkTitle || name || 'Artwork'}
                  className={placement === 'window' ? undefined : styles.preview}
                  crossOrigin="anonymous"
                />
              )}
            </PrintPresentation>
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
                    {artworkTitle || name}
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
