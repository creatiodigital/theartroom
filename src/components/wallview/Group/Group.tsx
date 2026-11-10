'use client'

import { memo } from 'react'
import type { RefObject } from 'react'
import { useSelector } from 'react-redux'

import { useMoveGroupArtwork } from '@/components/wallview/hooks/useMoveGroupArtwork'
import { ArtworkMeasurements } from '@/components/wallview/ArtworkMeasurements'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'

import styles from './Group.module.scss'

type GroupProps = {
  wallRef: RefObject<HTMLDivElement | null>
  boundingData: TDimensions | null
  scaleFactor: number
  preventClick: RefObject<boolean>
  groupArtworkHandlers: {
    handleAddArtworkToGroup: (id: string) => void
    handleRemoveArtworkGroup: () => void
  }
}

const Group: React.FC<GroupProps> = memo(({ wallRef, boundingData, scaleFactor, preventClick }) => {
  const artworkGroup = useSelector((state: RootState) => state.wallView.artworkGroup)
  const isDraggingGroup = useSelector((state: RootState) => state.wallView.isDraggingGroup)


  const { handleGroupDragStart, handleGroupDragEnd } = useMoveGroupArtwork(
    wallRef,
    boundingData,
    scaleFactor,
    preventClick,
  )

  const { groupHeight, groupWidth, groupY, groupX } = artworkGroup

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    handleGroupDragStart(event)
  }

  const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingGroup) {
      event.stopPropagation()
      handleGroupDragEnd()
    }
  }

  return (
    <div
      className={styles.group}
      style={{
        height: groupHeight as number,
        width: groupWidth as number,
        top: groupY,
        left: groupX,
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <ArtworkMeasurements width2d={groupWidth as number} height2d={groupHeight as number} />
    </div>
  )
})

Group.displayName = 'Group'

export default Group
