'use client'

import { useGLTF } from '@react-three/drei'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Mesh } from 'three'

import { ButtonIcon } from '@/components/ui/ButtonIcon'
import { Tooltip } from '@/components/ui/Tooltip'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { useCreateArtwork } from '@/components/wallview/hooks/useCreateArtwork'
import { useAddExistingArtwork } from '@/components/wallview/hooks/useAddExistingArtwork'
import { MediaLibrary } from '@/components/wallview/MediaLibrary'
import type { RootState } from '@/redux/store'

import styles from './CreatePanel.module.scss'

export const CreatePanel = () => {
  const [showMediaLibrary, setShowMediaLibrary] = useState(false)

  // Use exhibition spaceId to load the correct GLB for this exhibition
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const { nodes } = useGLTF(`/assets/spaces/${spaceId || 'classic'}.glb`) as unknown as {
    nodes: Record<string, Mesh>
  }

  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  const { handleCreateArtwork } = useCreateArtwork(boundingData!)
  const { handleAddExistingArtwork } = useAddExistingArtwork(boundingData)

  const handleArtworkDragStart = (e: React.DragEvent, artworkType: string) => {
    e.dataTransfer.setData('artworkType', artworkType)
  }

  const handleClickExistingArtwork = (artwork: {
    id: string
    name: string
    artworkType: string
  }) => {
    handleAddExistingArtwork(artwork.id)
    setShowMediaLibrary(false)
  }

  return (
    <>
      {showMediaLibrary && (
        <MediaLibrary
          onClose={() => setShowMediaLibrary(false)}
          onClickArtwork={handleClickExistingArtwork}
        />
      )}
      <div className={styles.panel}>
        <div className={styles.options}>
          <Tooltip label="Click or drag to wall to create an artistic image" top={-40}>
            <ButtonIcon
              size="big"
              icon="picture"
              onClick={() => handleCreateArtwork('image')}
              draggable
              onDragStart={(e) => handleArtworkDragStart(e, 'image')}
            />
          </Tooltip>
          <Tooltip label="Click or drag to wall to create an artistic text" top={-40}>
            <ButtonIcon
              size="big"
              icon="text"
              onClick={() => handleCreateArtwork('text')}
              draggable
              onDragStart={(e) => handleArtworkDragStart(e, 'text')}
            />
          </Tooltip>
          <Tooltip label="Add artwork from your library" top={-40}>
            <ButtonIcon
              size="big"
              icon="grid"
              onClick={() => setShowMediaLibrary(!showMediaLibrary)}
            />
          </Tooltip>
        </div>
      </div>
    </>
  )
}

export default CreatePanel
