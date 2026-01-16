'use client'

import { useSelector } from 'react-redux'

import { ArtworkEditModal } from '@/components/wallview/ArtworkEditModal'
import { CenterPanel } from '@/components/wallview/CenterPanel'
import { CreatePanel } from '@/components/wallview/CreatePanel'
import { LeftPanel } from '@/components/wallview/LeftPanel'
import { RightPanel } from '@/components/wallview/RightPanel'
import type { RootState } from '@/redux/store'

import styles from './WallView.module.scss'

export const WallView = () => {
  const editingArtworkId = useSelector((state: RootState) => state.wallView.editingArtworkId)

  return (
    <div className={styles.wallView}>
      <LeftPanel />
      <CenterPanel />
      <RightPanel />
      <CreatePanel />
      {editingArtworkId && <ArtworkEditModal artworkId={editingArtworkId} />}
    </div>
  )
}
