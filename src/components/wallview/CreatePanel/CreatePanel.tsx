'use client'

import { useGLTF } from '@react-three/drei'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Mesh } from 'three'

import { Button } from '@/components/ui/Button'
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
          <Tooltip label="Click to create image in the middle of the wall, or drag and drop anywhere on the wall" placement="top" offset={16}>
            <Button
              size="big"
              icon="image"
              onClick={() => handleCreateArtwork('image')}
              draggable
              onDragStart={(e) => handleArtworkDragStart(e, 'image')}
            />
          </Tooltip>
          <Tooltip label="Click to create text in the middle of the wall, or drag and drop anywhere on the wall" placement="top" offset={16}>
            <Button
              size="big"
              icon="type"
              onClick={() => handleCreateArtwork('text')}
              draggable
              onDragStart={(e) => handleArtworkDragStart(e, 'text')}
            />
          </Tooltip>
          <Tooltip label="Add artwork from your library" placement="top" offset={16}>
            <Button
              size="big"
              icon="gallery"
              onClick={() => setShowMediaLibrary(!showMediaLibrary)}
            />
          </Tooltip>
        </div>
      </div>
    </>
  )
}

export default CreatePanel
