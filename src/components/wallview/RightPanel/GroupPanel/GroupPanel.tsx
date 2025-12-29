'use client'

import { useGLTF } from '@react-three/drei'

import { useSelector } from 'react-redux'
import { Mesh } from 'three'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { NumberInput } from '@/components/ui/NumberInput'
import { H2, H3 } from '@/components/ui/Typography'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import type { RootState } from '@/redux/store'
import type { TAlign, TDistributeAlign } from '@/types/wizard'

import { useAlignGroup } from '../hooks/useAlignGroup'
import { useDistributeGroup } from '../hooks/useDistributeGroup'
import { useGroupDetails } from '../hooks/useGroupDetails'
import { useGroupHandlers } from '../hooks/useGroupHandlers'
import styles from '../RightPanel.module.scss'

const GroupPanel = () => {
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  // Use exhibition spaceId to load the correct GLB for this exhibition
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)

  const { nodes } = useGLTF(`/assets/spaces/${spaceId || 'classic'}.glb`) as unknown as {
    nodes: Record<string, Mesh>
  }
  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  const { groupX, groupY } = useGroupDetails()

  const { handleMoveGroupXChange, handleMoveGroupYChange, alignGroupToWall } = useGroupHandlers(
    artworkGroupIds,
    boundingData!,
  )

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
      <div className={styles.section}>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.item}>{`${artworkGroupIds.length}`} elements</div>
          </div>
        </div>
      </div>
      <div className={styles.section}>
        <H2 className={styles.title}>Group</H2>
        <div className={styles.subsection}>
          <H3 className={styles.subtitle}>Position in wall</H3>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="positionTop" onClick={() => handleAlignGroup('verticalTop')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="positionCenterV"
                onClick={() => handleAlignGroup('verticalCenter')}
              />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="positionBottom"
                onClick={() => handleAlignGroup('verticalBottom')}
              />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="positionLeft" onClick={() => handleAlignGroup('horizontalLeft')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="positionCenterH"
                onClick={() => handleAlignGroup('horizontalCenter')}
              />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="positionRight"
                onClick={() => handleAlignGroup('horizontalRight')}
              />
            </div>
          </div>
        </div>
        <div className={styles.subsection}>
          <H3 className={styles.subtitle}>Position (meters)</H3>
          <div className={styles.row}>
            <div className={styles.item}>
              <NumberInput
                value={groupX / 100}
                icon="move"
                rotate={90}
                min={0}
                max={1000}
                onChange={handleMoveGroupXChange}
              />
            </div>
            <div className={styles.item}>
              <NumberInput
                value={groupY / 100}
                icon="move"
                min={0}
                max={1000}
                onChange={handleMoveGroupYChange}
              />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.section}>
        <H2 className={styles.title}>Elements</H2>
        <div className={styles.subsection}>
          <H3 className={styles.subtitle}>Align Elements</H3>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon icon="verticalTop" onClick={() => handleAlignElements('verticalTop')} />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="verticalCenter"
                onClick={() => handleAlignElements('verticalCenter')}
              />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="verticalBottom"
                onClick={() => handleAlignElements('verticalBottom')}
              />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon
                icon="horizontalLeft"
                onClick={() => handleAlignElements('horizontalLeft')}
              />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="horizontalCenter"
                onClick={() => handleAlignElements('horizontalCenter')}
              />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="horizontalRight"
                onClick={() => handleAlignElements('horizontalRight')}
              />
            </div>
          </div>
        </div>
        <div className={styles.subsection}>
          <H3 className={styles.subtitle}>Distribution</H3>
          <div className={styles.row}>
            <div className={styles.item}>
              <ButtonIcon
                icon="distributeHorizontal"
                onClick={() => handleDistributeElements('horizontal')}
              />
            </div>
            <div className={styles.item}>
              <ButtonIcon
                icon="distributeVertical"
                onClick={() => handleDistributeElements('vertical')}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default GroupPanel
