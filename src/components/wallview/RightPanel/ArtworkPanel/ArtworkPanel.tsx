'use client'

import { useGLTF } from '@react-three/drei'

import { useSelector } from 'react-redux'
import { Mesh } from 'three'

import { Button } from '@/components/ui/Button'
import { NumberInput } from '@/components/ui/NumberInput'
import { Text } from '@/components/ui/Typography'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import type { RootState } from '@/redux/store'
import type { TAlign } from '@/types/wizard'

import { useArtworkDetails } from '../hooks/useArtworkDetails'
import { useArtworkHandlers } from '../hooks/useArtworkHandlers'
import styles from '../RightPanel.module.scss'

const ArtworkPanel = () => {
  // Use exhibition spaceId to load the correct GLB for this exhibition
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId)
  const { nodes } = useGLTF(`/assets/spaces/${spaceId || 'classic'}.glb`) as unknown as {
    nodes: Record<string, Mesh>
  }
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  const { width, height, x, y, artworkTitle } = useArtworkDetails(currentArtworkId!)
  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)

  const {
    handleAlignChange,
    handleMoveXChange,
    handleMoveYChange,
    handleWidthChange,
    handleHeightChange,
  } = useArtworkHandlers(currentArtworkId!, boundingData!)

  const handleAlign = (alignment: TAlign) => {
    handleAlignChange(alignment, wallWidth!, wallHeight!)
  }

  return (
    <>
      <Text font="dashboard" as="h1" size="lg" className={styles.panelTitle}>
        {artworkTitle || 'Untitled'}
      </Text>

      <div className={styles.editButtonWrapper}>
        <Button
          font="dashboard"
          size="small"
          variant="primary"
          label="Edit Artwork"
          href={`/dashboard/artworks/${currentArtworkId}/edit?returnUrl=${encodeURIComponent(window.location.pathname)}`}
        />
      </div>

      <div className={styles.section}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Position in wall
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
      </div>

      <div className={styles.section}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Position (meters)
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <NumberInput
              value={x / 100}
              icon="move"
              rotate={90}
              min={0}
              max={1000}
              onChange={handleMoveXChange}
            />
          </div>
          <div className={styles.item}>
            <NumberInput
              value={y / 100}
              icon="move"
              min={0}
              max={1000}
              onChange={handleMoveYChange}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <Text font="dashboard" as="span" size="xs" className={styles.label}>
          Size (meters)
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <NumberInput
              value={width / 100}
              icon="expand"
              rotate={90}
              min={0.1}
              max={50}
              onChange={handleWidthChange}
            />
          </div>
          <div className={styles.item}>
            <NumberInput
              value={height / 100}
              icon="expand"
              min={0.1}
              max={50}
              onChange={handleHeightChange}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default ArtworkPanel
