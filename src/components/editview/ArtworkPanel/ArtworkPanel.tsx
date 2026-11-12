'use client'

import { useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { ArrowRight, Image as ImageIcon } from '@phosphor-icons/react'

import { ToolPanel } from '@/components/editorChrome'
import { PrintPresentation } from '@/components/printPresentation/PrintPresentation'
import { Button } from '@/components/ui/Button'
import { RichText } from '@/components/ui/RichText'
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

  // Not drawn (questions.md Q137): the tool panels' shell, the work's title as the heading and the
  // artist as its line; the image, technique and dimensions in the body; View details below.
  return (
    <ToolPanel
      title={artworkTitle || name || 'Artwork'}
      description={selectedArtwork?.author}
      icon={ImageIcon}
      tint="walls"
      onClose={() => dispatch(hideArtworkPanel())}
      footer={
        <div className={styles.actions}>
          <Button
            variant="bare"
            font="dashboard"
            className={styles.viewDetails}
            onClick={handleViewDetails}
          >
            View details
            <ArrowRight size={16} weight="light" aria-hidden />
          </Button>
        </div>
      }
    >
      <div className={styles.content}>
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
        {selectedArtwork && (selectedArtwork.technique || artworkDimensions) && (
          <div className={styles.info}>
            {selectedArtwork.technique && (
              <RichText content={selectedArtwork.technique} variant="compact" />
            )}
            {artworkDimensions && <p className={styles.dimensions}>{artworkDimensions}</p>}
          </div>
        )}
      </div>
    </ToolPanel>
  )
}

export default ArtworkPanel
