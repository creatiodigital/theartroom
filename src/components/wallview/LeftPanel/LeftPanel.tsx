'use client'

import c from 'classnames'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { v4 as uuidv4 } from 'uuid'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
import { Tooltip } from '@/components/ui/Tooltip'
import { useSaveExhibition } from '@/components/wallview/hooks/useSaveExhibition'
import { restoreArtworksSnapshot, clearArtworksSnapshot } from '@/redux/slices/artworkSlice'
import { showEditMode } from '@/redux/slices/dashboardSlice'
import {
  restoreSnapshot,
  clearSnapshot,
  undo,
  redo,
  clearHistory,
  addAutofocusGroup,
  removeAutofocusGroup,
} from '@/redux/slices/exhibitionSlice'
import {
  showHuman,
  hideHuman,
  showRulers,
  hideRulers,
  removeGroup,
  toggleSnap,
  toggleGuidesLocked,
  setActiveAutofocusGroupId,
} from '@/redux/slices/wallViewSlice'
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
  const isRulersVisible = useSelector((state: RootState) => state.wallView.isRulersVisible)
  const isSnapEnabled = useSelector((state: RootState) => state.wallView.isSnapEnabled)
  const guidesLocked = useSelector((state: RootState) => state.wallView.guidesLocked)
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'text' | 'sound' | 'video'>('all')

  // Autofocus Groups
  const allAutofocusGroups = useSelector(
    (state: RootState) => state.exhibition.autofocusGroups ?? [],
  )
  const wallAutofocusGroups = useMemo(
    () => allAutofocusGroups.filter((g) => g.wallId === currentWallId),
    [allAutofocusGroups, currentWallId],
  )
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const activeGroupId = useSelector((state: RootState) => state.wallView.activeAutofocusGroupId)
  const [groupWarning, setGroupWarning] = useState(false)

  const canMakeGroup = artworkGroupIds.length >= 2

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

  const filteredWallArtworks = useMemo(() => {
    if (typeFilter === 'all') return wallArtworks
    return wallArtworks.filter((a) => a.artworkType === typeFilter)
  }, [wallArtworks, typeFilter])

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
      // When editing text in a contentEditable element, let the browser's
      // native undo/redo handle typing changes instead of our global handler
      if (e.target instanceof HTMLElement && e.target.isContentEditable) {
        return
      }

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
      return
    }

    // Clear the snapshot and history since we're keeping the changes
    dispatch(clearSnapshot())
    dispatch(clearArtworksSnapshot())
    dispatch(clearHistory())

    // Then hide wall view and show edit mode
    dispatch(hideHuman())
    dispatch(hideWallView())
    dispatch(showEditMode())
    dispatch(chooseCurrentArtworkId(null))
    dispatch(removeGroup())
  }

  const handleSaveProgress = async () => {
    // Save to database
    const success = await saveToDatabase()

    if (!success) {
      console.error('Failed to save progress')
      return
    }

    // Clear the snapshot and history to mark changes as saved
    // but keep the wall view open
    dispatch(clearSnapshot())
    dispatch(clearArtworksSnapshot())
    dispatch(clearHistory())
  }

  const handleCancel = () => {
    // Restore the exhibition and artworks state from before wall view was opened
    dispatch(restoreSnapshot())
    dispatch(restoreArtworksSnapshot())
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

  const handleToggleRulers = () => {
    if (isRulersVisible) {
      dispatch(hideRulers())
    } else {
      dispatch(showRulers())
    }
  }

  const handleToggleSnap = () => {
    dispatch(toggleSnap())
  }

  const handleToggleGuidesLocked = () => {
    dispatch(toggleGuidesLocked())
  }

  const handleSelectArtwork = (artworkId: string | null) => {
    if (currentArtworkId !== artworkId) {
      dispatch(chooseCurrentArtworkId(artworkId))
    }
    if (!isWizardOpen) {
      dispatch(showWizard())
    }
  }

  const handleMakeAutofocusGroup = () => {
    if (!canMakeGroup || !currentWallId) return

    // Check if any selected artwork already belongs to a group (any wall)
    const conflicting = artworkGroupIds.find((id) =>
      allAutofocusGroups.some((g) => g.artworkIds.includes(id)),
    )
    if (conflicting) {
      setGroupWarning(true)
      return
    }

    // Name is scoped per wall — find highest existing number to avoid duplicates after deletions
    const maxNum = wallAutofocusGroups.reduce((max, g) => {
      const match = g.name.match(/^Group (\d+)$/)
      return match ? Math.max(max, parseInt(match[1], 10)) : max
    }, 0)
    const groupNumber = maxNum + 1
    dispatch(
      addAutofocusGroup({
        id: uuidv4(),
        name: `Group ${groupNumber}`,
        wallId: currentWallId,
        artworkIds: [...artworkGroupIds],
      }),
    )
  }

  const handleDeleteAutofocusGroup = (groupId: string) => {
    dispatch(removeAutofocusGroup(groupId))
    if (activeGroupId === groupId) dispatch(setActiveAutofocusGroupId(null))
  }

  const handleToggleGroupHighlight = (groupId: string) => {
    dispatch(setActiveAutofocusGroupId(activeGroupId === groupId ? null : groupId))
  }

  return (
    <div
      className={styles.panel}
      data-no-deselect="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={styles.header}>
        <Text font="dashboard" as="h2" className={styles.headerTitle}>
          Wall Options
        </Text>
      </div>
      <div className={styles.section}>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.itemFlex}>
              <Tooltip label="Discard all changes and exit" placement="bottom" fullWidth>
                <Button
                  size="regular"
                  variant="secondary"
                  font="dashboard"
                  onClick={handleCancel}
                  label="Cancel"
                  disabled={saving}
                />
              </Tooltip>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.itemFlex}>
              <Tooltip label="Save all changes and continue editing" placement="bottom" fullWidth>
                <Button
                  size="regular"
                  variant="secondary"
                  font="dashboard"
                  onClick={handleSaveProgress}
                  label={saving ? 'Saving...' : 'Save Progress'}
                  disabled={saving}
                />
              </Tooltip>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.itemFlex}>
              <Tooltip label="Save all changes and exit" placement="bottom" fullWidth>
                <Button
                  size="regular"
                  variant="primary"
                  font="dashboard"
                  onClick={handleSaveWallView}
                  label={saving ? 'Saving...' : 'Save & Close'}
                  disabled={saving}
                />
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.itemFlex}>
              <Tooltip label="Undo (⌘Z)" placement="right" fullWidth>
                <Button
                  size="regular"
                  variant="secondary"
                  icon="undo"
                  onClick={handleUndo}
                  disabled={!canUndo}
                />
              </Tooltip>
            </div>
            <div className={styles.itemFlex}>
              <Tooltip label="Redo (⌘⇧Z)" placement="right" fullWidth>
                <Button
                  size="regular"
                  variant="secondary"
                  icon="redo"
                  onClick={handleRedo}
                  disabled={!canRedo}
                />
              </Tooltip>
            </div>
            <div className={styles.itemFlex}>
              <Tooltip label="Zoom out" placement="right" fullWidth>
                <Button size="regular" variant="secondary" icon="zoomOut" onClick={handleZoomOut} />
              </Tooltip>
            </div>
            <div className={styles.itemFlex}>
              <Tooltip label="Zoom in" placement="right" fullWidth>
                <Button size="regular" variant="secondary" icon="zoomIn" onClick={handleZoomIn} />
              </Tooltip>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.itemFlex}>
              <Tooltip label="Fit to view" placement="right" fullWidth>
                <Button size="regular" variant="secondary" icon="reset" onClick={handleResetView} />
              </Tooltip>
            </div>
            <div className={styles.itemFlex}>
              <Tooltip label="Show rulers & guides" placement="right" fullWidth>
                <Button
                  size="regular"
                  variant={isRulersVisible ? 'primary' : 'secondary'}
                  icon="ruler"
                  onClick={handleToggleRulers}
                />
              </Tooltip>
            </div>
            <div className={styles.itemFlex}>
              <Tooltip label="Lock Guides" placement="right" fullWidth>
                <Button
                  size="regular"
                  variant={guidesLocked ? 'primary' : 'secondary'}
                  icon="panel-bottom-dashed"
                  onClick={handleToggleGuidesLocked}
                  disabled={!isRulersVisible}
                />
              </Tooltip>
            </div>
            <div className={styles.itemFlex}>
              <Tooltip label="Snap align" placement="right" fullWidth>
                <Button
                  size="regular"
                  variant={isSnapEnabled ? 'primary' : 'secondary'}
                  icon="magnet"
                  onClick={handleToggleSnap}
                />
              </Tooltip>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.itemFlex}>
              <Tooltip label="Show human height reference" placement="right" fullWidth>
                <Button
                  size="regular"
                  variant={isHumanVisible ? 'primary' : 'secondary'}
                  icon="human-standing"
                  onClick={handleToggleHuman}
                />
              </Tooltip>
            </div>
            <div className={styles.itemFlex} />
            <div className={styles.itemFlex} />
            <div className={styles.itemFlex} />
          </div>
        </div>
      </div>
      {wallArtworks.length > 0 && (
        <div className={styles.section}>
          <div className={styles.tabs}>
            {(['all', 'image', 'text', 'video', 'sound'] as const).map((type) => (
              <button
                key={type}
                className={`${styles.tab} ${typeFilter === type ? styles.tabActive : ''}`}
                onClick={() => setTypeFilter(type)}
              >
                {type === 'all'
                  ? 'All'
                  : type === 'image'
                    ? 'Images'
                    : type === 'text'
                      ? 'Text'
                      : type === 'video'
                        ? 'Video'
                        : 'Sound'}
              </button>
            ))}
          </div>
          <div className={styles.subsection}>
            <ul className={styles.artworks}>
              {filteredWallArtworks.map((artwork) => (
                <li
                  key={artwork.id}
                  onClick={() => handleSelectArtwork(artwork.id)}
                  className={c(styles.artwork, {
                    [styles.selected]: artwork.id === currentArtworkId,
                  })}
                  style={{ cursor: 'pointer' }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      display: 'inline-flex',
                      width: 16,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {(artwork.artworkType === 'image' || artwork.artworkType === 'video') &&
                    artwork.imageUrl ? (
                      <img
                        src={artwork.imageUrl}
                        alt=""
                        width={10}
                        height={10}
                        style={{ objectFit: 'cover', borderRadius: 1, display: 'block' }}
                      />
                    ) : (
                      <span style={{ opacity: 0.5 }}>
                        <Icon
                          name={
                            artwork.artworkType === 'sound'
                              ? 'volume-2'
                              : artwork.artworkType === 'text'
                                ? 'type'
                                : artwork.artworkType === 'shape'
                                  ? 'shapes'
                                  : artwork.artworkType === 'video'
                                    ? 'video'
                                    : 'image'
                          }
                          size={14}
                          color="currentColor"
                        />
                      </span>
                    )}
                  </span>
                  <Text as="span" font="dashboard" size="sm">
                    {artwork.artworkTitle || artwork.name}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Autofocus Groups Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Text font="dashboard" as="h3" className={styles.sectionTitle}>
            Autofocus Groups
          </Text>
        </div>
        <div className={styles.subsection}>
          <div className={styles.row}>
            <div className={styles.itemFlex}>
              <Tooltip
                label={
                  canMakeGroup
                    ? 'Create autofocus group from selected artworks'
                    : 'Select 2 or more artworks to create a group'
                }
                placement="bottom"
                fullWidth
              >
                <Button
                  size="regular"
                  variant="secondary"
                  font="dashboard"
                  onClick={handleMakeAutofocusGroup}
                  label="Make Autofocus Group"
                  disabled={!canMakeGroup}
                />
              </Tooltip>
            </div>
          </div>
          {groupWarning && (
            <Modal onClose={() => setGroupWarning(false)}>
              <div style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
                <Text as="p" font="dashboard" size="sm">
                  This element already belongs to another autofocus group
                </Text>
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <Button
                    size="regular"
                    variant="secondary"
                    font="dashboard"
                    label="OK"
                    onClick={() => setGroupWarning(false)}
                  />
                </div>
              </div>
            </Modal>
          )}
          {wallAutofocusGroups.map((group) => (
            <div
              key={group.id}
              className={c(styles.groupRow, {
                [styles.groupRowActive]: activeGroupId === group.id,
              })}
              onClick={() => handleToggleGroupHighlight(group.id)}
            >
              <Icon
                name={activeGroupId === group.id ? 'eye' : 'eyeOff'}
                size={14}
                color="currentColor"
              />
              <Text as="span" font="dashboard" size="sm" className={styles.groupName}>
                {group.name} ({group.artworkIds.length})
              </Text>
              <button
                className={styles.groupDelete}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteAutofocusGroup(group.id)
                }}
              >
                <Icon name="close" size={14} color="currentColor" />
              </button>
            </div>
          ))}
          {wallAutofocusGroups.length === 0 && (
            <Text as="p" font="dashboard" size="sm" style={{ opacity: 0.5 }}>
              No groups created
            </Text>
          )}
        </div>
      </div>
    </div>
  )
}

export default LeftPanel
