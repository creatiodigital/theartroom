'use client'

import { useGLTF } from '@react-three/drei'

import { useSelector } from 'react-redux'
import { Mesh } from 'three'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { Input } from '@/components/ui/Input'
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

  const { width, height, x, y, name } = useArtworkDetails(currentArtworkId!)
  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)

  const {
    handleNameChange,
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
      <div className={styles.section}>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.item}>
              <span className={styles.label}>Name</span>
              <Input id="artworkName" value={name} onChange={handleNameChange} />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.section}>
        <Text as="h2" className={styles.title}>Position</Text>
        <div className={styles.subsection}>
          <Text as="h3" className={styles.subtitle}>Position in wall</Text>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="positionTop" onClick={() => handleAlign('verticalTop')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="positionCenterV" onClick={() => handleAlign('verticalCenter')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="positionBottom" onClick={() => handleAlign('verticalBottom')} />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="positionLeft" onClick={() => handleAlign('horizontalLeft')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="positionCenterH" onClick={() => handleAlign('horizontalCenter')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon icon="positionRight" onClick={() => handleAlign('horizontalRight')} />
            </div>
          </div>
        </div>
        <div className={styles.subsection}>
          <Text as="h3" className={styles.subtitle}>Position (meters)</Text>
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
      </div>
      <div className={styles.section}>
        <Text as="h2" className={styles.title}>Layout</Text>
        <div className={styles.subsection}>
          <Text as="h3" className={styles.subtitle}>Size (meters)</Text>
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
      </div>
    </>
  )
}

export default ArtworkPanel
