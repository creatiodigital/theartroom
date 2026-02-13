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
import { setSnapEnabled } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TAlign, TDistributeAlign } from '@/types/wizard'

import { useAlignGroup } from '../hooks/useAlignGroup'
import { useDistributeGroup } from '../hooks/useDistributeGroup'
import { useGroupDetails } from '../hooks/useGroupDetails'
import { useGroupHandlers } from '../hooks/useGroupHandlers'
import styles from '../RightPanel.module.scss'

const GroupPanel = () => {
  const dispatch = useDispatch()
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const snapEnabled = useSelector((state: RootState) => state.wallView.snapEnabled)
  // Use exhibition spaceId to load the correct GLB for this exhibition
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)

  const gltfPath = spaceConfigs[spaceId || 'classic']?.gltfPath || '/assets/spaces/classic.glb'
  const { nodes } = useGLTF(gltfPath) as unknown as {
    nodes: Record<string, Mesh>
  }
  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  const { fromTop, fromBottom, fromLeft, fromRight } = useGroupDetails()

  const {
    handleFromLeftChange,
    handleFromRightChange,
    handleFromTopChange,
    handleFromBottomChange,
    alignGroupToWall,
  } = useGroupHandlers(artworkGroupIds, boundingData!)

  const { alignArtworksInGroup } = useAlignGroup(boundingData)
  const { distributeArtworksInGroup } = useDistributeGroup(boundingData)

  const handleAlignElements = (alignment: TAlign) => {
    alignArtworksInGroup(alignment)
  }

  const handleDistributeElements = (alignment: TDistributeAlign) => {
    distributeArtworksInGroup(alignment)
  }

  const handleAlignGroup = (alignment: TAlign) => {
    alignGroupToWall(alignment)
  }

  return (
    <>
      <Text font="dashboard" as="h1" size="lg" className={styles.panelTitle}>
        {artworkGroupIds.length} elements
      </Text>

      <div className={styles.section}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Position in wall
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionTop"
              onClick={() => handleAlignGroup('verticalTop')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionCenterV"
              onClick={() => handleAlignGroup('verticalCenter')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionBottom"
              onClick={() => handleAlignGroup('verticalBottom')}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionLeft"
              onClick={() => handleAlignGroup('horizontalLeft')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionCenterH"
              onClick={() => handleAlignGroup('horizontalCenter')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="positionRight"
              onClick={() => handleAlignGroup('horizontalRight')}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Vertical position (m)
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
      </div>

      <div className={styles.section}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Horizontal position (m)
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
        <div style={{ marginTop: 'var(--space-3)' }} data-no-deselect="true">
          <Checkbox
            checked={snapEnabled}
            onChange={(e) => dispatch(setSnapEnabled(e.target.checked))}
            label="Snap Align"
          />
        </div>
      </div>

      <div className={styles.section}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Align Elements
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="verticalTop"
              onClick={() => handleAlignElements('verticalTop')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="verticalCenter"
              onClick={() => handleAlignElements('verticalCenter')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="verticalBottom"
              onClick={() => handleAlignElements('verticalBottom')}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="horizontalLeft"
              onClick={() => handleAlignElements('horizontalLeft')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="horizontalCenter"
              onClick={() => handleAlignElements('horizontalCenter')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="horizontalRight"
              onClick={() => handleAlignElements('horizontalRight')}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Distribution
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="distributeHorizontal"
              onClick={() => handleDistributeElements('horizontal')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="distributeVertical"
              onClick={() => handleDistributeElements('vertical')}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default GroupPanel
