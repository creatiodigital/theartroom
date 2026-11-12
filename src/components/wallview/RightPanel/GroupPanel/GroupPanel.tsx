'use client'

import { useMemo } from 'react'
import { WALL_SCALE } from '@/components/wallview/constants'
import { useGLTF } from '@react-three/drei'
import { ArrowsOutLineHorizontal, ArrowsOutLineVertical, LockSimple } from '@phosphor-icons/react'

import { useSelector, useDispatch } from 'react-redux'
import { Mesh } from 'three'

import { Button } from '@/components/ui/Button'
import { NumberInput } from '@/components/ui/NumberInput'
import { Tooltip } from '@/components/ui/Tooltip'
import { getSpaceConfig, type SpaceKey } from '@/components/scene/constants'
import { DistanceBox, ItemThumb, PanelGroup, SegmentStrip } from '@/components/wallview/chrome'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { cmEventToMeters } from '@/components/wallview/utils'

import type { RootState } from '@/redux/store'
import { toggleArtworkLocked } from '@/redux/slices/exhibitionSlice'
import type { PresetType } from '../PresetSection/applyPresetToArtwork'
import type { TAlign, TDistributeAlign } from '@/types/wizard'

import { ELEMENT_ALIGNS, WALL_PLACES } from '../alignments'
import { useAlignGroup } from '../hooks/useAlignGroup'
import { useDistributeGroup } from '../hooks/useDistributeGroup'
import { useGroupDetails } from '../hooks/useGroupDetails'
import { useGroupHandlers } from '../hooks/useGroupHandlers'
import GroupPresetApply from './GroupPresetApply'
import styles from '../RightPanel.module.scss'
import { spaceGltfUrl } from '@/components/scene/spaceAsset'

const GroupPanel = () => {
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const dispatch = useDispatch()

  // Determine if ALL grouped artworks share the same type
  const uniformType = useMemo((): PresetType | null => {
    if (artworkGroupIds.length < 2) return null
    const types = artworkGroupIds.map((id) => artworksById[id]?.artworkType || 'image')
    const allSame = types.every((t) => t === types[0])
    if (!allSame) return null
    // Map artwork kinds to preset types (image/text/shape are directly supported)
    const kind = types[0] as string
    if (kind === 'image' || kind === 'text' || kind === 'shape') return kind
    // sound and video artworks use image presets (frame/support/shadow properties)
    if (kind === 'sound' || kind === 'video') return 'image'
    return null
  }, [artworkGroupIds, artworksById])

  // Use exhibition spaceId to load the correct GLB for this exhibition
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)

  const gltfPath = spaceGltfUrl(getSpaceConfig(spaceId || 'paris').gltfPath)
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

  // Display only (wallview.md §4): the header's thumbnails, count and names. "Works" when every
  // selected item is an image (an untyped one counts as an image, as `uniformType` reads it).
  const selected = artworkGroupIds.flatMap((id) =>
    artworksById[id] ? [{ id, artwork: artworksById[id] }] : [],
  )
  const allImages = selected.every(({ artwork }) => (artwork.artworkType || 'image') === 'image')
  const names = selected
    .map(({ artwork }) => artwork.artworkTitle || artwork.name)
    .filter(Boolean)
    .join(', ')

  return (
    <>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span aria-hidden className={styles.stack}>
            {selected.slice(0, 3).map(({ id, artwork }) => (
              <ItemThumb
                key={id}
                artworkType={artwork.artworkType}
                imageUrl={artwork.imageUrl}
                size="stack"
              />
            ))}
          </span>
          <div className={styles.identityText}>
            <h2 className={styles.name}>
              {artworkGroupIds.length} {allImages ? 'works' : 'elements'} selected
            </h2>
            {names && <p className={styles.names}>{names}</p>}
          </div>
          <Tooltip label="Lock all" placement="bottom">
            <Button
              variant="bare"
              font="dashboard"
              className={styles.iconButton}
              aria-label="Lock all"
              onClick={() => {
                artworkGroupIds.forEach((id) => {
                  dispatch(toggleArtworkLocked({ artworkId: id }))
                })
              }}
            >
              <LockSimple size={16} weight="light" aria-hidden />
            </Button>
          </Tooltip>
        </div>
      </header>

      <div className={styles.body}>
        <PanelGroup title="Line them up">
          <SegmentStrip
            label="Align to each other"
            segments={ELEMENT_ALIGNS.map(({ align, label, icon }) => ({
              key: align,
              label,
              icon,
              onClick: () => handleAlignElements(align),
            }))}
          />
          <div className={styles.grid2}>
            <Button
              variant="bare"
              font="dashboard"
              className={styles.evenGaps}
              aria-label="Even gaps across"
              onClick={() => handleDistributeElements('horizontal')}
            >
              <ArrowsOutLineHorizontal size={15} weight="light" aria-hidden />
              Even gaps ↔
            </Button>
            <Button
              variant="bare"
              font="dashboard"
              className={styles.evenGaps}
              aria-label="Even gaps up and down"
              onClick={() => handleDistributeElements('vertical')}
            >
              <ArrowsOutLineVertical size={15} weight="light" aria-hidden />
              Even gaps ↕
            </Button>
          </div>
        </PanelGroup>

        <PanelGroup title="Place the group on the wall">
          <SegmentStrip
            label="Place on the wall"
            segments={WALL_PLACES.map(({ align, label, icon }) => ({
              key: align,
              label,
              icon,
              onClick: () => handleAlignGroup(align),
            }))}
          />
          <DistanceBox
            label="Distance to the wall edges"
            itemLabel="group"
            top={
              <NumberInput
                size="compact"
                aria-label="From top, cm"
                value={Math.round((fromTop / WALL_SCALE) * 100)}
                min={0}
                max={100000}
                onChange={(e) => handleFromTopChange(cmEventToMeters(e))}
              />
            }
            bottom={
              <NumberInput
                size="compact"
                aria-label="From bottom, cm"
                value={Math.round((fromBottom / WALL_SCALE) * 100)}
                min={0}
                max={100000}
                onChange={(e) => handleFromBottomChange(cmEventToMeters(e))}
              />
            }
            left={
              <NumberInput
                size="compact"
                aria-label="From left, cm"
                value={Math.round((fromLeft / WALL_SCALE) * 100)}
                min={0}
                max={100000}
                onChange={(e) => handleFromLeftChange(cmEventToMeters(e))}
              />
            }
            right={
              <NumberInput
                size="compact"
                aria-label="From right, cm"
                value={Math.round((fromRight / WALL_SCALE) * 100)}
                min={0}
                max={100000}
                onChange={(e) => handleFromRightChange(cmEventToMeters(e))}
              />
            }
          />
          {/* The four numbers measure to the group's center (questions.md Q144). */}
          <p className={styles.note}>
            All in cm, to the center of the group. Type a number to move it.
          </p>
        </PanelGroup>

        {uniformType && (
          <PanelGroup title="Preset for all">
            <GroupPresetApply artworkIds={artworkGroupIds} uniformType={uniformType} />
          </PanelGroup>
        )}
      </div>
    </>
  )
}

export default GroupPanel
