'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { WALL_SCALE } from '@/components/wallview/constants'
import { zOrderToBack, zOrderToFront, type LayerItem } from '@/components/wallview/layerOrder'
import { useGLTF } from '@react-three/drei'
import {
  LinkSimple,
  LockSimple,
  LockSimpleOpen,
  SelectionBackground,
  SelectionForeground,
} from '@phosphor-icons/react'
import c from 'classnames'

import { useSelector, useDispatch } from 'react-redux'
import { Mesh } from 'three'

import { SliderRow } from '@/components/editorChrome'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { NumberInput } from '@/components/ui/NumberInput'
import { Tooltip } from '@/components/ui/Tooltip'
import { getSpaceConfig, type SpaceKey } from '@/components/scene/constants'
import {
  DistanceBox,
  ItemThumb,
  PanelGroup,
  SegmentStrip,
  TabStrip,
} from '@/components/wallview/chrome'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { cmEventToMeters } from '@/components/wallview/utils'
import { getOriginalDimensions, hasPendingUpload } from '@/lib/pendingUploads'
import { formatPrintSize, getPrintMaxSize } from '@/lib/print-providers/printspace/sizeBounds'
import {
  updateArtworkPosition,
  toggleArtworkLocked,
  setArtworkZOrder,
  pushToHistory,
} from '@/redux/slices/exhibitionSlice'
import { setSizeLocked } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TAlign } from '@/types/wizard'

import { TYPE_NAMES, WALL_PLACES } from '../alignments'
import { useArtworkDetails } from '../hooks/useArtworkDetails'
import { useArtworkHandlers } from '../hooks/useArtworkHandlers'
import styles from '../RightPanel.module.scss'
import { spaceGltfUrl } from '@/components/scene/spaceAsset'

export type ItemTab = 'text' | 'layout' | 'look'

const ITEM_TABS = [
  { id: 'layout', label: 'Layout' },
  { id: 'look', label: 'Look' },
] as const satisfies readonly { id: ItemTab; label: string }[]

// AR-182: a text's words are written in its own first tab.
const TEXT_ITEM_TABS = [{ id: 'text', label: 'Text' }, ...ITEM_TABS] as const satisfies readonly {
  id: ItemTab
  label: string
}[]

type ArtworkPanelProps = {
  /** The open tab; RightPanel keeps it while the selection changes (wallview.md §3). */
  tab: ItemTab
  onTabChange: (tab: ItemTab) => void
  /** RightPanel's View details button (its save-first handler lives there); none for shapes. */
  viewDetails?: ReactNode
  /** A line under the actions, e.g. View details' refused save. */
  notice?: ReactNode
  /** More of the Size group for one type: a text box's Fit box to text. */
  layoutExtra?: ReactNode
  /** AR-182: a text's Text tab, first (its words, in each language). Only texts have one. */
  textTab?: ReactNode
  /** The Look tab: the type's own panel. */
  children?: ReactNode
}

/**
 * One selected item in the right panel (wallview.md §3): the header (thumbnail, name, type and
 * size, Lock / Move to front / Move to back, View details), the Layout / Look tabs, and the
 * Layout tab itself. Both tabs stay mounted (the hidden one `hidden`), so the type panels mount
 * when they always did.
 */
const ArtworkPanel = ({
  tab: chosenTab,
  onTabChange,
  viewDetails,
  notice,
  layoutExtra,
  textTab,
  children,
}: ArtworkPanelProps) => {
  const dispatch = useDispatch()
  // Text kept while an image is selected reads as Layout (only texts have a Text tab).
  const tab: ItemTab = chosenTab === 'text' && !textTab ? 'layout' : chosenTab
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const sizeLocked = useSelector((state: RootState) =>
    currentArtworkId ? (state.wallView.sizeLockedById[currentArtworkId] ?? false) : false,
  )

  // Use exhibition spaceId to load the correct GLB for this exhibition
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const gltfPath = spaceGltfUrl(getSpaceConfig(spaceId || 'paris').gltfPath)
  const { nodes } = useGLTF(gltfPath) as unknown as {
    nodes: Record<string, Mesh>
  }
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  // Get artwork data to check if it has an uploaded image
  const allArtworkIds = useSelector((state: RootState) => state.artworks.allIds)
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const artwork = currentArtworkId ? artworksById[currentArtworkId] : null
  const exhibitionArtwork = currentArtworkId ? exhibitionArtworksById[currentArtworkId] : null
  const isLocked = exhibitionArtwork?.locked ?? false

  const { width, height, fromTop, fromBottom, fromLeft, fromRight } = useArtworkDetails(
    currentArtworkId!,
  )
  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)

  const widthCm = Math.round((width / WALL_SCALE) * 100)
  const heightCm = Math.round((height / WALL_SCALE) * 100)

  // Local input strings so partial typing is allowed without snapping
  // back to the formatted Redux value mid-edit.
  const [widthInputStr, setWidthInputStr] = useState(String(widthCm))
  const [heightInputStr, setHeightInputStr] = useState(String(heightCm))
  const [widthFocused, setWidthFocused] = useState(false)
  const [heightFocused, setHeightFocused] = useState(false)

  useEffect(() => {
    if (!widthFocused) setWidthInputStr(String(widthCm))
  }, [widthCm, widthFocused])
  useEffect(() => {
    if (!heightFocused) setHeightInputStr(String(heightCm))
  }, [heightCm, heightFocused])

  const {
    handleAlignChange,
    handleFromTopChange,
    handleFromBottomChange,
    handleFromLeftChange,
    handleFromRightChange,
    handleWidthChange,
    handleHeightChange,
  } = useArtworkHandlers(currentArtworkId!, boundingData!)

  const handleAlign = (alignment: TAlign) => {
    handleAlignChange(alignment, wallWidth!, wallHeight!)
  }

  // Check if we can show the "Use image proportions" button
  // Show for any image artwork that has either a pending upload or an existing imageUrl
  const hasPendingImage = currentArtworkId ? hasPendingUpload(currentArtworkId) : false
  const hasExistingImage = artwork?.artworkType === 'image' && artwork?.imageUrl
  const showProportionsButton =
    artwork?.artworkType === 'image' && (hasPendingImage || hasExistingImage)

  const handleUseImageProportions = async () => {
    if (!currentArtworkId || !exhibitionArtwork) return

    let originalWidth: number
    let originalHeight: number

    // Priority 1: a freshly dropped file that isn't on the canvas yet — its
    // local preview is the full-resolution original, so its dimensions match
    // what's currently painted.
    const pendingDimensions = getOriginalDimensions(currentArtworkId)
    if (pendingDimensions) {
      originalWidth = pendingDimensions.width
      originalHeight = pendingDimensions.height
    }
    // Priority 2: a saved image — measure the WEB image that's actually
    // rendered, not the print-master dimensions. The canvas paints `imageUrl`
    // with `background-size: cover`, which crops to the element's ratio. The
    // master and the web-optimized WebP differ by the sub-pixel rounding of
    // the resize, so using the master ratio leaves a thin strip of a bordered
    // image clipped. Measuring the rendered WebP makes the match exact.
    else if (artwork?.imageUrl) {
      try {
        const img = new Image()
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Failed to load image'))
          img.src = artwork.imageUrl!
        })
        originalWidth = img.naturalWidth
        originalHeight = img.naturalHeight
      } catch {
        console.error('Failed to load image dimensions')
        return
      }
    } else {
      return
    }

    const originalRatio = originalWidth / originalHeight

    const currentWidth = exhibitionArtwork.width2d
    const currentHeight = exhibitionArtwork.height2d

    let newWidth: number
    let newHeight: number

    // Keep the larger dimension, adjust the smaller one
    if (currentWidth >= currentHeight) {
      newWidth = currentWidth
      newHeight = currentWidth / originalRatio
    } else {
      newHeight = currentHeight
      newWidth = currentHeight * originalRatio
    }

    // Update both width and height
    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: {
          width2d: newWidth,
          height2d: newHeight,
        },
      }),
    )
  }

  // Every item sharing this wall, in creation order — the tie-break
  // `zOrderToFront` / `zOrderToBack` need to work out a new position.
  const wallItems: LayerItem[] = useMemo(() => {
    const wallId = exhibitionArtwork?.wallId
    if (!wallId) return []
    const items: LayerItem[] = []
    allArtworkIds.forEach((id) => {
      const artwork = artworksById[id]
      const pos = exhibitionArtworksById[id]
      if (!artwork || !pos || pos.wallId !== wallId) return
      items.push({ id, artworkType: artwork.artworkType, zOrder: pos.zOrder })
    })
    return items
  }, [allArtworkIds, artworksById, exhibitionArtworksById, exhibitionArtwork?.wallId])

  const handleMoveToFront = () => {
    if (!currentArtworkId) return
    dispatch(pushToHistory())
    dispatch(setArtworkZOrder({ artworkId: currentArtworkId, zOrder: zOrderToFront(wallItems) }))
  }

  const handleMoveToBack = () => {
    if (!currentArtworkId) return
    dispatch(pushToHistory())
    dispatch(setArtworkZOrder({ artworkId: currentArtworkId, zOrder: zOrderToBack(wallItems) }))
  }

  // Proportional resize handlers (when Lock size is checked)
  const handleLockedWidthChange = (newWidthMeters: number) => {
    if (!sizeLocked || !currentArtworkId || !exhibitionArtwork) {
      handleWidthChange(newWidthMeters)
      return
    }

    const currentRatio = width / height
    const newWidth2d = newWidthMeters * WALL_SCALE
    const newHeight2d = newWidth2d / currentRatio

    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: {
          width2d: newWidth2d,
          height2d: newHeight2d,
        },
      }),
    )
  }

  const handleLockedHeightChange = (newHeightMeters: number) => {
    if (!sizeLocked || !currentArtworkId || !exhibitionArtwork) {
      handleHeightChange(newHeightMeters)
      return
    }

    const currentRatio = width / height
    const newHeight2d = newHeightMeters * WALL_SCALE
    const newWidth2d = newHeight2d * currentRatio

    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: {
          width2d: newWidth2d,
          height2d: newHeight2d,
        },
      }),
    )
  }

  // Handlers still work in meters; convert cm → m at the edge.
  const minCm = 10
  const commitFromString = (raw: string, commit: (v: number) => void) => {
    const parsed = parseFloat(raw.replace(',', '.'))
    if (Number.isFinite(parsed) && parsed >= minCm) commit(parsed / 100)
  }

  // Print-max line — image artworks with known resolution only. Shows the largest size a buyer
  // can actually order so the artist doesn't display a wall artwork bigger than anything on
  // sale (questions.md Q143: it was a marker on the width / height sliders). Hidden when
  // resolution is missing so a placeholder value never reads as a real cap.
  const isImage = artwork?.artworkType === 'image'
  let imageMeta: { width: number; height: number } | null = null
  if (isImage && currentArtworkId) {
    const pending = getOriginalDimensions(currentArtworkId)
    if (pending) imageMeta = pending
    else if (artwork?.originalWidth && artwork?.originalHeight) {
      imageMeta = { width: artwork.originalWidth, height: artwork.originalHeight }
    }
  }
  const printMax = imageMeta ? getPrintMaxSize(imageMeta) : null

  const typeName = TYPE_NAMES[artwork?.artworkType ?? '']

  return (
    <>
      <header className={styles.header}>
        <div className={styles.identity}>
          <ItemThumb
            artworkType={artwork?.artworkType}
            imageUrl={artwork?.imageUrl}
            size="header"
          />
          <div className={styles.identityText}>
            <h2 className={styles.name}>{artwork?.name || 'Artwork'}</h2>
            {/* Height first (the gallery convention); the size never gives way to the type. */}
            <p className={styles.meta}>
              {typeName && <span className={styles.metaType}>{typeName} · </span>}
              <span className={styles.metaSize}>
                {heightCm} × {widthCm} cm
              </span>
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          <Tooltip label="Lock artwork" placement="bottom">
            <Button
              variant="bare"
              font="dashboard"
              className={c(styles.iconButton, isLocked && styles.pressed)}
              aria-pressed={isLocked}
              aria-label="Lock artwork"
              onClick={() =>
                currentArtworkId && dispatch(toggleArtworkLocked({ artworkId: currentArtworkId }))
              }
            >
              {isLocked ? (
                <LockSimple size={16} weight="light" aria-hidden />
              ) : (
                <LockSimpleOpen size={16} weight="light" aria-hidden />
              )}
            </Button>
          </Tooltip>
          <Tooltip label="Move to front" placement="bottom">
            <Button
              variant="bare"
              font="dashboard"
              className={styles.iconButton}
              aria-label="Move to front"
              onClick={handleMoveToFront}
              disabled={isLocked}
            >
              <SelectionForeground size={16} weight="light" aria-hidden />
            </Button>
          </Tooltip>
          <Tooltip label="Move to back" placement="bottom">
            <Button
              variant="bare"
              font="dashboard"
              className={styles.iconButton}
              aria-label="Move to back"
              onClick={handleMoveToBack}
              disabled={isLocked}
            >
              <SelectionBackground size={16} weight="light" aria-hidden />
            </Button>
          </Tooltip>
          {viewDetails && <span className={styles.actionsEnd}>{viewDetails}</span>}
        </div>
        {notice}
        <TabStrip
          label="Item settings"
          tabs={textTab ? TEXT_ITEM_TABS : ITEM_TABS}
          selected={tab}
          onSelect={onTabChange}
        />
      </header>

      <div className={styles.body}>
        {textTab && (
          <div
            role="tabpanel"
            aria-label="Text"
            hidden={tab !== 'text'}
            className={styles.tabPanel}
          >
            {textTab}
          </div>
        )}
        <div
          role="tabpanel"
          aria-label="Layout"
          hidden={tab !== 'layout'}
          className={styles.tabPanel}
        >
          <PanelGroup title="Size" disabled={isLocked}>
            <div className={styles.sizeRow}>
              <label className={styles.sizeField}>
                <span className={styles.fieldLabel}>Width</span>
                <span className={styles.numberBox}>
                  <Input
                    size="bare"
                    className={styles.numberInputWrap}
                    inputClassName={styles.numberInput}
                    type="text"
                    inputMode="numeric"
                    value={widthInputStr}
                    onChange={(e) => {
                      setWidthInputStr(e.target.value)
                      commitFromString(e.target.value, handleLockedWidthChange)
                    }}
                    onFocus={() => setWidthFocused(true)}
                    onBlur={() => {
                      setWidthFocused(false)
                      setWidthInputStr(String(widthCm))
                    }}
                    disabled={isLocked}
                  />
                  <span aria-hidden className={styles.unit}>
                    cm
                  </span>
                </span>
              </label>
              <Tooltip label="Lock proportions when resizing" placement="top">
                <label
                  className={c(styles.chain, sizeLocked && styles.chainOn)}
                  data-no-deselect="true"
                >
                  <input
                    type="checkbox"
                    className={styles.chainInput}
                    checked={sizeLocked}
                    onChange={(e) =>
                      currentArtworkId &&
                      dispatch(
                        setSizeLocked({ artworkId: currentArtworkId, value: e.target.checked }),
                      )
                    }
                    disabled={isLocked}
                    aria-label="Lock proportions when resizing"
                  />
                  <LinkSimple size={15} weight="light" aria-hidden />
                </label>
              </Tooltip>
              <label className={styles.sizeField}>
                <span className={styles.fieldLabel}>Height</span>
                <span className={styles.numberBox}>
                  <Input
                    size="bare"
                    className={styles.numberInputWrap}
                    inputClassName={styles.numberInput}
                    type="text"
                    inputMode="numeric"
                    value={heightInputStr}
                    onChange={(e) => {
                      setHeightInputStr(e.target.value)
                      commitFromString(e.target.value, handleLockedHeightChange)
                    }}
                    onFocus={() => setHeightFocused(true)}
                    onBlur={() => {
                      setHeightFocused(false)
                      setHeightInputStr(String(heightCm))
                    }}
                    disabled={isLocked}
                  />
                  <span aria-hidden className={styles.unit}>
                    cm
                  </span>
                </span>
              </label>
            </div>
            {showProportionsButton && (
              <Button
                variant="bare"
                font="dashboard"
                className={styles.link}
                onClick={handleUseImageProportions}
                disabled={isLocked}
              >
                Use image proportions
              </Button>
            )}
            {layoutExtra}
            {printMax && (
              <p className={styles.note}>
                Largest print on sale: {formatPrintSize(printMax.heightCm, printMax.widthCm)}
              </p>
            )}
          </PanelGroup>

          <PanelGroup title="Place on the wall" disabled={isLocked}>
            <SegmentStrip
              label="Place on the wall"
              segments={WALL_PLACES.map(({ align, label, icon }) => ({
                key: align,
                label,
                icon,
                onClick: () => handleAlign(align),
                disabled: isLocked,
              }))}
            />
          </PanelGroup>

          <PanelGroup title="Distance to the wall edges" disabled={isLocked}>
            <DistanceBox
              label="Distance to the wall edges"
              itemLabel="artwork"
              top={
                <NumberInput
                  size="compact"
                  aria-label="From top, cm"
                  value={Math.round((fromTop / WALL_SCALE) * 100)}
                  min={0}
                  max={100000}
                  onChange={(e) => handleFromTopChange(cmEventToMeters(e))}
                  disabled={isLocked}
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
                  disabled={isLocked}
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
                  disabled={isLocked}
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
                  disabled={isLocked}
                />
              }
            />
            {/* The four numbers measure to the artwork's center (questions.md Q144). */}
            <p className={styles.note}>
              All in cm, to the center of the artwork. Type a number to move it.
            </p>
          </PanelGroup>

          {/* Rotation slider - shapes only */}
          {artwork?.artworkType === 'shape' && exhibitionArtwork && (
            <PanelGroup disabled={isLocked}>
              <SliderRow
                label="Rotation"
                value={`${Math.round(exhibitionArtwork.rotation ?? 0)}°`}
                sliderValue={exhibitionArtwork.rotation ?? 0}
                min={0}
                max={360}
                step={1}
                onChange={(v) => {
                  if (!currentArtworkId) return
                  dispatch(
                    updateArtworkPosition({
                      artworkId: currentArtworkId,
                      artworkPosition: { rotation: v },
                    }),
                  )
                }}
                disabled={isLocked}
              />
            </PanelGroup>
          )}
        </div>

        <div role="tabpanel" aria-label="Look" hidden={tab !== 'look'} className={styles.tabPanel}>
          {children}
        </div>
      </div>
    </>
  )
}

export default ArtworkPanel
