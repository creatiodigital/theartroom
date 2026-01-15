'use client'

import c from 'classnames'
import { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { useSaveExhibition } from '@/components/wallview/hooks/useSaveExhibition'
import { showEditMode } from '@/redux/slices/dashboardSlice'
import {
  restoreSnapshot,
  clearSnapshot,
  undo,
  redo,
  clearHistory,
} from '@/redux/slices/exhibitionSlice'
import { showHuman, hideHuman, removeGroup } from '@/redux/slices/wallViewSlice'
import {
  increaseScaleFactor,
  decreaseScaleFactor,
  resetPan,
  hideWallView,
  chooseCurrentArtworkId,
} from '@/redux/slices/wallViewSlice'
import { showWizard } from '@/redux/slices/wizardSlice'
import type { RootState } from '@/redux/store'
import { toRuntimeArtwork } from '@/utils/artworkTransform'

import styles from './LeftPanel.module.scss'

export const LeftPanel = () => {
  const dispatch = useDispatch()
  const { saveToDatabase, saving } = useSaveExhibition()

  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const allIds = useSelector((state: RootState) => state.artworks.allIds)
  const positionsById = useSelector((state: RootState) => state.exhibition.exhibitionArtworksById)

  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const isWizardOpen = useSelector((state: RootState) => state.wizard.isWizardOpen)
  const isHumanVisible = useSelector((state: RootState) => state.wallView.isHumanVisible)

  // Undo/Redo state
  const historyLength = useSelector((state: RootState) => state.exhibition._history?.length ?? 0)
  const futureLength = useSelector((state: RootState) => state.exhibition._future?.length ?? 0)
  const canUndo = historyLength > 0
  const canRedo = futureLength > 0

  const wallArtworks = useMemo(() => {
    if (!currentWallId) return []

    return allIds
      .map((id) => {
        const artwork = artworksById[id]
        const pos = positionsById[id]
        if (!artwork || !pos) return null
        if (pos.wallId !== currentWallId) return null
        return toRuntimeArtwork(artwork, pos)
      })
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .reverse()
  }, [allIds, artworksById, positionsById, currentWallId])

  const handleZoomIn = () => dispatch(increaseScaleFactor())
  const handleZoomOut = () => dispatch(decreaseScaleFactor())
  const handleResetView = () => dispatch(resetPan())

  const handleUndo = () => {
    if (canUndo) {
      dispatch(undo())
    }
  }

  const handleRedo = () => {
    if (canRedo) {
      dispatch(redo())
    }
  }

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+Z (Mac) or Ctrl+Z (Windows)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          // Cmd+Shift+Z = Redo
          e.preventDefault()
          if (canRedo) {
            dispatch(redo())
          }
        } else {
          // Cmd+Z = Undo
          e.preventDefault()
          if (canUndo) {
            dispatch(undo())
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch, canUndo, canRedo])

  const handleSaveWallView = async () => {
    // Save to database first
    const success = await saveToDatabase()

    if (!success) {
      // Optionally show error - for now just log
      console.error('Failed to save to database')
    }

    // Clear the snapshot and history since we're keeping the changes
    dispatch(clearSnapshot())
    dispatch(clearHistory())

    // Then hide wall view and show edit mode
    dispatch(hideHuman())
    dispatch(hideWallView())
    dispatch(showEditMode())
    dispatch(chooseCurrentArtworkId(null))
    dispatch(removeGroup())
  }

  const handleCancel = () => {
    // Restore the exhibition state from before wall view was opened
    dispatch(restoreSnapshot())
    dispatch(hideHuman())
    dispatch(hideWallView())
    dispatch(showEditMode())
    dispatch(chooseCurrentArtworkId(null))
    dispatch(removeGroup())
  }

  const handleToggleHuman = () => {
    if (isHumanVisible) {
      dispatch(hideHuman())
    } else {
      dispatch(showHuman())
    }
  }

  const handleSelectArtwork = (artworkId: string | null) => {
    if (currentArtworkId !== artworkId) {
      dispatch(chooseCurrentArtworkId(artworkId))
    }
    if (!isWizardOpen) {
      dispatch(showWizard())
    }
  }

  return (
    <div
      className={styles.panel}
      data-no-deselect="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={styles.section}>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.itemFlex}>
              <Button
                size="regular"
                variant="secondary"
                font="dashboard"
                onClick={handleCancel}
                label="Cancel"
              />
            </div>
            <div className={styles.itemFlex}>
              <Button
                size="regular"
                variant="primary"
                font="dashboard"
                onClick={handleSaveWallView}
                label={saving ? 'Saving...' : 'Save'}
              />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.itemFlex}>
              <Button
                size="regular"
                variant="secondary"
                icon="undo"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (⌘Z)"
              />
            </div>
            <div className={styles.itemFlex}>
              <Button
                size="regular"
                variant="secondary"
                icon="redo"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (⌘⇧Z)"
              />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.itemFlex}>
              <Button size="regular" variant="secondary" icon="zoomOut" onClick={handleZoomOut} />
            </div>
            <div className={styles.itemFlex}>
              <Button size="regular" variant="secondary" icon="zoomIn" onClick={handleZoomIn} />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.itemFlex}>
              <Button size="regular" variant="secondary" icon="reset" onClick={handleResetView} />
            </div>
            <div className={styles.itemFlex}>
              <Button size="regular" variant="secondary" icon="person" onClick={handleToggleHuman} />
            </div>
          </div>
        </div>
      </div>
      {wallArtworks.length > 0 && (
        <div className={styles.section}>
          <div className={styles.subsection}>
            <ul className={styles.artworks}>
              {wallArtworks.map((artwork) => (
                <li
                  key={artwork.id}
                  onClick={() => handleSelectArtwork(artwork.id)}
                  className={c(styles.artwork, {
                    [styles.selected]: artwork.id === currentArtworkId,
                  })}
                  style={{ cursor: 'pointer' }}
                >
                  <Text
                    as="span"
                    font="dashboard"
                    size="sm"
                  >
                    {artwork.artworkTitle || artwork.name}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeftPanel

