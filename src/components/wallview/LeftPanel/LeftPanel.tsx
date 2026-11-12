'use client'

import c from 'classnames'
import { useEffect, useId, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { v4 as uuidv4 } from 'uuid'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CornersOut,
  Eye,
  EyeSlash,
  LockSimple,
  Magnet,
  Minus,
  Person,
  Plus,
  Ruler,
  X,
} from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
import { Tooltip } from '@/components/ui/Tooltip'
import { HelperSwitch, ItemThumb, SegmentStrip } from '@/components/wallview/chrome'
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
  markWallSaved,
} from '@/redux/slices/wallViewSlice'
import { showWizard } from '@/redux/slices/wizardSlice'
import type { RootState } from '@/redux/store'
import { toRuntimeArtwork } from '@/utils/artworkTransform'

import styles from './LeftPanel.module.scss'
import { selectAutofocusGroups } from '@/redux/selectors/autofocusGroups'
import { selectWallUnsaved } from '@/redux/selectors/wallUnsaved'
import { useArtworkChangedElsewhere } from '@/hooks/artworkReread'
import { InfoLine } from '@/components/editorChrome'
import { isTypingTarget } from '@/utils/isTypingTarget'

// The list filter, in today's order and words.
const TYPE_FILTERS = [
  { type: 'all', label: 'All' },
  { type: 'image', label: 'Images' },
  { type: 'text', label: 'Text' },
  { type: 'video', label: 'Video' },
  { type: 'sound', label: 'Sound' },
] as const

// A row's type, after its name (designs/wall-view.dc.html).
const TYPE_NAMES: Record<string, string> = {
  image: 'Image',
  text: 'Text',
  shape: 'Shape',
  video: 'Video',
  sound: 'Sound',
}

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
  const allAutofocusGroups = useSelector(selectAutofocusGroups)
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

  // Display only (wallview.md §1): the header's title, the strip's zoom, and a refused save
  // (questions.md Q139 b), shown until the next edit (anything a save sends changes) or an
  // accepted save.
  const scaleFactor = useSelector((state: RootState) => state.wallView.scaleFactor)
  const mainTitle = useSelector((state: RootState) => state.exhibition.mainTitle)
  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const [saveFailed, setSaveFailed] = useState(false)
  useEffect(() => {
    setSaveFailed(false)
  }, [artworksById, positionsById, allAutofocusGroups])
  // Unsaved changes (questions.md Q142): saved-content edits since the last accepted save.
  // `wallEdits` is read when a save goes out, so an edit made during the save keeps the dot.
  const unsaved = useSelector(selectWallUnsaved)
  // Q153: a work edited in the studio is waiting for this wall to be saved or discarded.
  const changedElsewhere = useArtworkChangedElsewhere()
  const wallEdits = useSelector((state: RootState) => state.wallView.wallEdits)
  // Q81 / Q142: with unsaved changes, reloading, closing the tab or typing a URL asks the
  // browser's own "Leave site?". In-app links are not caught.
  useEffect(() => {
    if (!unsaved) return
    const askFirst = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Older Chrome asks only when returnValue is set.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', askFirst)
    return () => window.removeEventListener('beforeunload', askFirst)
  }, [unsaved])
  const helpersId = useId()
  const itemsId = useId()
  const groupsId = useId()

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
      // When typing in a field or contentEditable text, let the browser's
      // native undo/redo handle it instead of our global handler.
      if (isTypingTarget(e.target)) {
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
      setSaveFailed(true)
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
    const sentAt = wallEdits
    // Save to database
    const success = await saveToDatabase()

    if (!success) {
      console.error('Failed to save progress')
      setSaveFailed(true)
      return
    }

    // Clear the snapshot and history to mark changes as saved
    // but keep the wall view open
    dispatch(clearSnapshot())
    dispatch(clearArtworksSnapshot())
    dispatch(clearHistory())
    setSaveFailed(false)
    dispatch(markWallSaved(sentAt))
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
  // "{exhibition} · {wall width} cm": a long name takes the ellipsis, the width always shows.
  const wallSize = wallWidth ? `${Math.round(wallWidth * 100)} cm` : ''

  return (
    <aside
      aria-label="Wall options"
      className={styles.panel}
      data-no-deselect="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>Editing wall</span>
          {(mainTitle || wallSize) && (
            <h1 className={styles.title}>
              {mainTitle && <span className={styles.titleName}>{mainTitle}</span>}
              {mainTitle && wallSize && <span> · </span>}
              {wallSize && <span className={styles.titleSize}>{wallSize}</span>}
            </h1>
          )}
        </div>
        <div className={styles.saveRow}>
          <Tooltip label="Discard all changes and exit" placement="bottom">
            <Button
              variant="bare"
              font="dashboard"
              className={styles.cancel}
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
          </Tooltip>
          <Tooltip label="Save all changes and continue editing" placement="bottom">
            <Button
              variant="bare"
              font="dashboard"
              className={styles.save}
              onClick={handleSaveProgress}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Tooltip>
          <Tooltip label="Save all changes and exit" placement="bottom">
            <Button
              variant="bare"
              font="dashboard"
              className={styles.saveClose}
              onClick={handleSaveWallView}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save & close'}
            </Button>
          </Tooltip>
        </div>
        {/* One line, as the 3D editor's Save area (Q150): a refused save, else Unsaved changes. */}
        {saveFailed ? (
          <p role="alert" className={styles.failed}>
            Not saved. Please try again.
          </p>
        ) : (
          <p role="status" className={styles.status}>
            {unsaved && (
              <>
                <span className={styles.dot} aria-hidden />
                Unsaved changes
              </>
            )}
          </p>
        )}
        {/* Polite, as a status: the work's studio edit is loaded after a save or a discard. */}
        <div role="status" className={styles.notice}>
          {changedElsewhere && (
            <InfoLine>
              This work was changed in another tab. Save or discard your wall changes to load it.
            </InfoLine>
          )}
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.strip}>
          <Tooltip label="Undo (⌘Z)" placement="right">
            <Button
              variant="bare"
              font="dashboard"
              className={styles.raised}
              aria-label="Undo"
              onClick={handleUndo}
              disabled={!canUndo}
            >
              <ArrowCounterClockwise size={17} weight="light" aria-hidden />
            </Button>
          </Tooltip>
          <Tooltip label="Redo (⌘⇧Z)" placement="right">
            <Button
              variant="bare"
              font="dashboard"
              className={styles.raised}
              aria-label="Redo"
              onClick={handleRedo}
              disabled={!canRedo}
            >
              <ArrowClockwise size={17} weight="light" aria-hidden />
            </Button>
          </Tooltip>
          <span aria-hidden className={styles.stripDivider} />
          <Tooltip label="Zoom out" placement="right">
            <Button
              variant="bare"
              font="dashboard"
              className={styles.zoomButton}
              aria-label="Zoom out"
              onClick={handleZoomOut}
            >
              <Minus size={15} weight="light" aria-hidden />
            </Button>
          </Tooltip>
          <span aria-live="polite" className={styles.zoom}>
            {Math.round(scaleFactor * 100)}%
          </span>
          <Tooltip label="Zoom in" placement="right">
            <Button
              variant="bare"
              font="dashboard"
              className={styles.zoomButton}
              aria-label="Zoom in"
              onClick={handleZoomIn}
            >
              <Plus size={15} weight="light" aria-hidden />
            </Button>
          </Tooltip>
          <Tooltip label="Fit to view" placement="right">
            <Button
              variant="bare"
              font="dashboard"
              className={c(styles.raised, styles.fit)}
              onClick={handleResetView}
            >
              <CornersOut size={14} weight="light" aria-hidden />
              Fit
            </Button>
          </Tooltip>
        </div>

        <section aria-labelledby={helpersId} className={c(styles.section, styles.helpers)}>
          <h2 id={helpersId} className={styles.caption}>
            Helpers
          </h2>
          <HelperSwitch
            icon={Ruler}
            title="Rulers & guides"
            line="Measure and line things up"
            checked={isRulersVisible}
            onChange={handleToggleRulers}
          />
          <HelperSwitch
            icon={LockSimple}
            title="Lock guides"
            line={isRulersVisible ? undefined : 'Turn on rulers first'}
            checked={guidesLocked}
            onChange={handleToggleGuidesLocked}
            disabled={!isRulersVisible}
            dependent
          />
          <HelperSwitch
            icon={Magnet}
            title="Snap to align"
            line="Works snap to edges and centers"
            checked={isSnapEnabled}
            onChange={handleToggleSnap}
          />
          {/* The figure's height is Wall.tsx's `humanHeight` (170 cm). */}
          <HelperSwitch
            icon={Person}
            title="Person for scale"
            line="A 170 cm figure on the wall"
            checked={isHumanVisible}
            onChange={handleToggleHuman}
          />
        </section>

        {wallArtworks.length > 0 && (
          <section aria-labelledby={itemsId} className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 id={itemsId} className={styles.caption}>
                On this wall
              </h2>
              <span className={styles.count}>
                {wallArtworks.length === 1 ? '1 item' : `${wallArtworks.length} items`}
              </span>
            </div>
            <SegmentStrip
              label="Show"
              segments={TYPE_FILTERS.map(({ type, label }) => ({
                key: type,
                label,
                pressed: typeFilter === type,
                onClick: () => setTypeFilter(type),
              }))}
            />
            <ul className={styles.items}>
              {filteredWallArtworks.map((artwork) => {
                const isSelected = artwork.id === currentArtworkId
                return (
                  <li key={artwork.id}>
                    <Button
                      variant="bare"
                      font="dashboard"
                      className={c(styles.item, isSelected && styles.selected)}
                      aria-current={isSelected ? 'true' : undefined}
                      onClick={() => handleSelectArtwork(artwork.id)}
                    >
                      <ItemThumb
                        artworkType={artwork.artworkType}
                        imageUrl={artwork.imageUrl}
                        size="row"
                      />
                      <span className={styles.itemName}>
                        {artwork.artworkTitle || artwork.name}
                      </span>
                      <span className={styles.itemKind}>
                        {TYPE_NAMES[artwork.artworkType ?? ''] ?? ''}
                      </span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section aria-labelledby={groupsId} className={c(styles.section, styles.groups)}>
          <div className={styles.sectionHead}>
            <h2 id={groupsId} className={styles.caption}>
              Autofocus groups
            </h2>
            <Tooltip
              label={
                canMakeGroup
                  ? 'Create autofocus group from selected artworks'
                  : 'Select 2 or more artworks to create a group'
              }
              placement="bottom"
            >
              <Button
                variant="bare"
                font="dashboard"
                className={styles.newGroup}
                onClick={handleMakeAutofocusGroup}
                disabled={!canMakeGroup}
              >
                <Plus size={12} weight="light" aria-hidden />
                New group
              </Button>
            </Tooltip>
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
          {wallAutofocusGroups.length > 0 && (
            <ul className={styles.groupList}>
              {wallAutofocusGroups.map((group) => {
                const isShown = activeGroupId === group.id
                const count = group.artworkIds.length
                return (
                  <li key={group.id} className={styles.groupRow}>
                    <span aria-hidden className={styles.groupThumbs}>
                      {group.artworkIds.slice(0, 3).map((id) => {
                        const artwork = artworksById[id]
                        return artwork ? (
                          <ItemThumb
                            key={id}
                            artworkType={artwork.artworkType}
                            imageUrl={artwork.imageUrl}
                            size="group"
                          />
                        ) : null
                      })}
                    </span>
                    <span className={styles.groupText}>
                      <span className={styles.groupName}>{group.name}</span>
                      <span className={styles.groupCount}>
                        {count === 1 ? '1 work' : `${count} works`}
                      </span>
                    </span>
                    <Button
                      variant="bare"
                      font="dashboard"
                      className={styles.groupButton}
                      aria-pressed={isShown}
                      aria-label={`Show ${group.name} outline`}
                      onClick={() => handleToggleGroupHighlight(group.id)}
                    >
                      {isShown ? (
                        <Eye size={16} weight="light" aria-hidden />
                      ) : (
                        <EyeSlash size={16} weight="light" aria-hidden />
                      )}
                    </Button>
                    <Button
                      variant="bare"
                      font="dashboard"
                      className={styles.groupButton}
                      aria-label={`Remove ${group.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteAutofocusGroup(group.id)
                      }}
                    >
                      <X size={14} weight="light" aria-hidden />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          {wallAutofocusGroups.length === 0 && <p className={styles.empty}>No groups created</p>}
        </section>
      </div>
    </aside>
  )
}

export default LeftPanel
