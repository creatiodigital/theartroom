'use client'

import { useGLTF } from '@react-three/drei'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Mesh } from 'three'
import {
  FolderSimplePlus,
  Image as ImageIcon,
  Shapes,
  SpeakerHigh,
  TextT,
  VideoCamera,
} from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { getSpaceConfig, type SpaceKey } from '@/components/scene/constants'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { useCreateArtwork } from '@/components/wallview/hooks/useCreateArtwork'
import { useAddExistingArtwork } from '@/components/wallview/hooks/useAddExistingArtwork'
import { MediaLibrary } from '@/components/wallview/MediaLibrary'
import type { RootState } from '@/redux/store'

import styles from './CreatePanel.module.scss'
import { spaceGltfUrl } from '@/components/scene/spaceAsset'

// The five things to add, in today's order, with today's tooltips (wallview.md §2: the name
// under each icon is new).
const ADD_ITEMS = [
  {
    type: 'image',
    label: 'Image',
    icon: ImageIcon,
    tooltip:
      'Click to create image in the middle of the wall, or drag and drop anywhere on the wall',
  },
  {
    type: 'text',
    label: 'Text',
    icon: TextT,
    tooltip:
      'Click to create text in the middle of the wall, or drag and drop anywhere on the wall',
  },
  {
    type: 'shape',
    label: 'Shape',
    icon: Shapes,
    tooltip: 'Click to create a decorative shape, or drag and drop anywhere on the wall',
  },
  {
    type: 'video',
    label: 'Video',
    icon: VideoCamera,
    tooltip:
      'Click to create video in the middle of the wall, or drag and drop anywhere on the wall',
  },
  {
    type: 'sound',
    label: 'Sound',
    icon: SpeakerHigh,
    tooltip:
      'Click to create sound in the middle of the wall, or drag and drop anywhere on the wall',
  },
] as const

export const CreatePanel = () => {
  const [showMediaLibrary, setShowMediaLibrary] = useState(false)

  // Use exhibition spaceId to load the correct GLB for this exhibition
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const gltfPath = spaceGltfUrl(getSpaceConfig(spaceId || 'paris').gltfPath)
  const { nodes } = useGLTF(gltfPath) as unknown as {
    nodes: Record<string, Mesh>
  }

  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  const { handleCreateArtwork } = useCreateArtwork(boundingData!)
  const { handleAddExistingArtwork, duplicateError, clearDuplicateError } =
    useAddExistingArtwork(boundingData)

  const handleArtworkDragStart = (e: React.DragEvent, artworkType: string) => {
    e.dataTransfer.setData('artworkType', artworkType)
  }

  const handleClickExistingArtwork = (artwork: {
    id: string
    name: string
    artworkType: string
  }) => {
    handleAddExistingArtwork(artwork.id)
  }

  return (
    <>
      {showMediaLibrary && (
        <MediaLibrary
          onClose={() => {
            clearDuplicateError()
            setShowMediaLibrary(false)
          }}
          onClickArtwork={handleClickExistingArtwork}
          duplicateError={duplicateError}
        />
      )}
      <div className={styles.panel}>
        <nav aria-label="Add to the wall" className={styles.bar}>
          <Tooltip label="Add artwork from your library" placement="top" offset={16}>
            <Button
              variant="bare"
              font="dashboard"
              className={styles.library}
              onClick={() => setShowMediaLibrary(!showMediaLibrary)}
            >
              <FolderSimplePlus size={20} weight="light" aria-hidden />
              From library
            </Button>
          </Tooltip>
          <span aria-hidden className={styles.divider} />
          {ADD_ITEMS.map(({ type, label, icon: AddIcon, tooltip }) => (
            <Tooltip key={type} label={tooltip} placement="top" offset={16}>
              <Button
                variant="bare"
                font="dashboard"
                className={styles.add}
                onClick={() => handleCreateArtwork(type)}
                draggable
                onDragStart={(e) => handleArtworkDragStart(e, type)}
              >
                <AddIcon size={20} weight="light" aria-hidden />
                <span className={styles.addLabel}>{label}</span>
              </Button>
            </Tooltip>
          ))}
        </nav>
        <p className={styles.hint}>
          Click to add in the middle of the wall, or drag onto the wall.
        </p>
      </div>
    </>
  )
}

export default CreatePanel
