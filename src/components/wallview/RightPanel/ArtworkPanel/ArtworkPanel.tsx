'use client'

import { useGLTF } from '@react-three/drei'

import { useSelector, useDispatch } from 'react-redux'
import { Mesh } from 'three'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { NumberInput } from '@/components/ui/NumberInput'
import { Text } from '@/components/ui/Typography'
import { spaceConfigs, type SpaceKey } from '@/components/scene/constants'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { getOriginalDimensions, hasPendingUpload } from '@/lib/pendingUploads'
import { updateArtworkPosition } from '@/redux/slices/exhibitionSlice'
import { setSizeLocked } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TAlign } from '@/types/wizard'

import { useArtworkDetails } from '../hooks/useArtworkDetails'
import { useArtworkHandlers } from '../hooks/useArtworkHandlers'
import styles from '../RightPanel.module.scss'

const ArtworkPanel = () => {
  const dispatch = useDispatch()
  const sizeLocked = useSelector((state: RootState) => state.wallView.sizeLocked)

  // Use exhibition spaceId to load the correct GLB for this exhibition
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const gltfPath = spaceConfigs[spaceId || 'classic']?.gltfPath || '/assets/spaces/classic.glb'
  const { nodes } = useGLTF(gltfPath) as unknown as {
    nodes: Record<string, Mesh>
  }
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  // Get artwork data to check if it has an uploaded image
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const exhibitionArtworksById = useSelector((state: RootState) => state.exhibition.exhibitionArtworksById)
  const artwork = currentArtworkId ? artworksById[currentArtworkId] : null
  const exhibitionArtwork = currentArtworkId ? exhibitionArtworksById[currentArtworkId] : null

  const { width, height, fromTop, fromBottom, fromLeft, fromRight } = useArtworkDetails(currentArtworkId!)
  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)

  const {
    handleAlignChange,
    handleFromTopChange,
    handleFromBottomChange,
    handleFromLeftChange,
    handleFromRightChange,
    handleWidthChange,
    handleHeightChange,
  } = useArtworkHandlers(currentArtworkId!, boundingData!)

  const handleAlign = (alignment: TAlign) => {
    handleAlignChange(alignment, wallWidth!, wallHeight!)
  }

  // Check if we can show the "Use image proportions" button
  // Show for any image artwork that has either a pending upload or an existing imageUrl
  const hasPendingImage = currentArtworkId ? hasPendingUpload(currentArtworkId) : false
  const hasExistingImage = artwork?.artworkType === 'image' && artwork?.imageUrl
  const showProportionsButton = artwork?.artworkType === 'image' && (hasPendingImage || hasExistingImage)

  const handleUseImageProportions = async () => {
    if (!currentArtworkId || !exhibitionArtwork) return

    let originalWidth: number
    let originalHeight: number

    // Priority 1: Get dimensions from pending upload (freshly dropped)
    const pendingDimensions = getOriginalDimensions(currentArtworkId)
    if (pendingDimensions) {
      originalWidth = pendingDimensions.width
      originalHeight = pendingDimensions.height
    }
    // Priority 2: Get dimensions from artwork data (stored in DB)
    else if (artwork?.originalWidth && artwork?.originalHeight) {
      originalWidth = artwork.originalWidth
      originalHeight = artwork.originalHeight
    }
    // Priority 3: Load dynamically from image URL as fallback
    else if (artwork?.imageUrl) {
      try {
        const img = new Image()
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Failed to load image'))
          img.src = artwork.imageUrl!
        })
        originalWidth = img.naturalWidth
        originalHeight = img.naturalHeight
      } catch {
        console.error('Failed to load image dimensions')
        return
      }
    } else {
      return
    }

    const originalRatio = originalWidth / originalHeight

    const currentWidth = exhibitionArtwork.width2d
    const currentHeight = exhibitionArtwork.height2d

    let newWidth: number
    let newHeight: number

    // Keep the larger dimension, adjust the smaller one
    if (currentWidth >= currentHeight) {
      newWidth = currentWidth
      newHeight = currentWidth / originalRatio
    } else {
      newHeight = currentHeight
      newWidth = currentHeight * originalRatio
    }

    // Update both width and height
    dispatch(updateArtworkPosition({
      artworkId: currentArtworkId,
      artworkPosition: {
        width2d: newWidth,
        height2d: newHeight,
      },
    }))
  }

  // Proportional resize handlers (when Lock size is checked)
  const handleLockedWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!sizeLocked || !currentArtworkId || !exhibitionArtwork) {
      handleWidthChange(e)
      return
    }

    const newWidthMeters = Number(e.target.value)
    const currentRatio = width / height
    const newWidth2d = newWidthMeters * 100
    const newHeight2d = newWidth2d / currentRatio

    dispatch(updateArtworkPosition({
      artworkId: currentArtworkId,
      artworkPosition: {
        width2d: newWidth2d,
        height2d: newHeight2d,
      },
    }))
  }

  const handleLockedHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!sizeLocked || !currentArtworkId || !exhibitionArtwork) {
      handleHeightChange(e)
      return
    }

    const newHeightMeters = Number(e.target.value)
    const currentRatio = width / height
    const newHeight2d = newHeightMeters * 100
    const newWidth2d = newHeight2d * currentRatio

    dispatch(updateArtworkPosition({
      artworkId: currentArtworkId,
      artworkPosition: {
        width2d: newWidth2d,
        height2d: newHeight2d,
      },
    }))
  }

  return (
    <>
      {/* HEADER Section */}
      <div className={styles.header}>
        <Text font="dashboard" as="h2" size="sm" weight="bold" className={styles.headerTitle}>
          {artwork?.name || 'Artwork'}
        </Text>
      </div>

      {/* POSITION Section */}
      <div className={styles.section}>
        
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Alignment
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button size="small" variant="secondary" icon="positionTop" onClick={() => handleAlign('verticalTop')} />
          </div>
          <div className={styles.item}>
            <Button size="small" variant="secondary" icon="positionCenterV" onClick={() => handleAlign('verticalCenter')} />
          </div>
          <div className={styles.item}>
            <Button size="small" variant="secondary" icon="positionBottom" onClick={() => handleAlign('verticalBottom')} />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button size="small" variant="secondary" icon="positionLeft" onClick={() => handleAlign('horizontalLeft')} />
          </div>
          <div className={styles.item}>
            <Button size="small" variant="secondary" icon="positionCenterH" onClick={() => handleAlign('horizontalCenter')} />
          </div>
          <div className={styles.item}>
            <Button size="small" variant="secondary" icon="positionRight" onClick={() => handleAlign('horizontalRight')} />
          </div>
        </div>

        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Vertical Position (m)
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <NumberInput
              value={fromTop / 100}
              icon="arrowTopFromLine"
              label="from top"
              min={0}
              max={1000}
              onChange={handleFromTopChange}
            />
          </div>
          <div className={styles.item}>
            <NumberInput
              value={fromBottom / 100}
              icon="arrowBottomFromLine"
              label="from bottom"
              min={0}
              max={1000}
              onChange={handleFromBottomChange}
            />
          </div>
        </div>

        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Horizontal Position (m)
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <NumberInput
              value={fromLeft / 100}
              icon="arrowLeftFromLine"
              label="from left"
              min={0}
              max={1000}
              onChange={handleFromLeftChange}
            />
          </div>
          <div className={styles.item}>
            <NumberInput
              value={fromRight / 100}
              icon="arrowRightFromLine"
              label="from right"
              min={0}
              max={1000}
              onChange={handleFromRightChange}
            />
          </div>
        </div>
      </div>

      {/* SIZE Section */}
      <div className={styles.section}>
        
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Dimensions (m)
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <NumberInput
              value={width / 100}
              icon="moveHorizontal"
              label="horizontal"
              min={0.1}
              max={50}
              onChange={handleLockedWidthChange}
            />
          </div>
          <div className={styles.item}>
            <NumberInput
              value={height / 100}
              icon="moveVertical"
              label="vertical"
              min={0.1}
              max={50}
              onChange={handleLockedHeightChange}
            />
          </div>
        </div>
        {showProportionsButton && (
          <div style={{ marginTop: 'var(--space-2)' }}>
            <Button
              font="dashboard"
              fullWidth
              variant="secondary"
              label="Use image proportions"
              onClick={handleUseImageProportions}
            />
          </div>
        )}
        <div style={{ marginTop: 'var(--space-3)' }} data-no-deselect="true">
          <Checkbox
            checked={sizeLocked}
            onChange={(e) => dispatch(setSizeLocked(e.target.checked))}
            label="Lock proportions when resizing"
          />
        </div>
      </div>
    </>
  )
}

export default ArtworkPanel


