'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import Tooltip from '@/components/ui/Tooltip/Tooltip'
import { hasAnyPendingUploads } from '@/lib/pendingUploads'
import { selectAutofocusGroups } from '@/redux/selectors/autofocusGroups'
import { markWallSaved, openArtworkEditModal } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import { ArtisticImagePanel } from './ArtisticImagePanel'
import { ArtisticSoundPanel } from './ArtisticSoundPanel'
import { ArtisticTextPanel } from './ArtisticTextPanel'
import ArtisticVideoPanel from './ArtisticVideoPanel/ArtisticVideoPanel'
import { ArtworkPanel, type ItemTab } from './ArtworkPanel'
import { GroupPanel } from './GroupPanel'
import { ShapePanel } from './ShapePanel/ShapePanel'
import { useArtworkDetails } from './hooks/useArtworkDetails'
import { useSaveExhibition } from '../hooks/useSaveExhibition'
import styles from './RightPanel.module.scss'

const RightPanel = () => {
  const dispatch = useDispatch()
  const isWizardOpen = useSelector((state: RootState) => state.wizard.isWizardOpen)
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  // Check if there are unsaved changes (history, snapshot, or pending image uploads)
  const hasUnsavedChanges =
    useSelector(
      (state: RootState) =>
        (state.exhibition as { _history: unknown[] })._history.length > 0 ||
        (state.exhibition as { _snapshot: unknown })._snapshot !== null,
    ) || hasAnyPendingUploads()

  const { artworkType } = useArtworkDetails(currentArtworkId!)
  const { saveToDatabase, saving } = useSaveExhibition()

  // Lock state for disabling type-specific panels
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const isLocked = currentArtworkId
    ? (exhibitionArtworksById[currentArtworkId]?.locked ?? false)
    : false

  const isGroupCreated = artworkGroupIds.length > 1

  // Display only (wallview.md §3): the tab, kept while the selection changes; and a refused
  // save-first of View details (questions.md Q139 b), shown until the next edit (anything a save
  // sends changes), another selection or an accepted save.
  const [tab, setTab] = useState<ItemTab>('layout')
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const autofocusGroups = useSelector(selectAutofocusGroups)
  const [detailsFailed, setDetailsFailed] = useState(false)
  useEffect(() => {
    setDetailsFailed(false)
  }, [artworksById, exhibitionArtworksById, autofocusGroups, currentArtworkId])
  // Unsaved changes (questions.md Q142): an accepted save-first saves the whole wall too.
  const wallEdits = useSelector((state: RootState) => state.wallView.wallEdits)

  // Save first, then open the edit modal
  const handleEditArtworkDetails = async () => {
    if (!currentArtworkId) return

    // Always save to database before opening modal
    // This ensures new artworks and pending image uploads are persisted
    // Check hasAnyPendingUploads() at call time since it's not reactive
    if (hasUnsavedChanges || hasAnyPendingUploads()) {
      const sentAt = wallEdits
      const success = await saveToDatabase()
      if (!success) {
        console.error('Failed to save before editing')
        setDetailsFailed(true)
        return
      }
      dispatch(markWallSaved(sentAt))
    }
    setDetailsFailed(false)

    // Open the modal overlay
    dispatch(openArtworkEditModal(currentArtworkId))
  }

  // Determine button label
  const getButtonLabel = () => {
    if (saving) return 'Saving…'
    if (hasUnsavedChanges) return 'View details'
    return 'View details'
  }

  return (
    <aside
      aria-label="Selection"
      className={styles.panel}
      data-no-deselect="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {isGroupCreated && <GroupPanel />}
      {!isGroupCreated && isWizardOpen && currentArtworkId && (
        <ArtworkPanel
          tab={tab}
          onTabChange={setTab}
          viewDetails={
            artworkType !== 'shape' && (
              <Tooltip
                label="Clicking will save any pending changes on the current selected artwork"
                placement="top"
              >
                <Button
                  variant="bare"
                  font="dashboard"
                  className={styles.detailsButton}
                  onClick={handleEditArtworkDetails}
                  disabled={saving}
                >
                  {getButtonLabel()}
                </Button>
              </Tooltip>
            )
          }
          notice={
            detailsFailed && (
              <p role="alert" className={styles.failed}>
                Not saved. Please try again.
              </p>
            )
          }
          layoutExtra={artworkType === 'text' && <ArtisticTextPanel part="fit" />}
        >
          {artworkType === 'image' && <ArtisticImagePanel disabled={isLocked} />}
          {artworkType === 'text' && <ArtisticTextPanel disabled={isLocked} />}
          {artworkType === 'sound' && <ArtisticSoundPanel disabled={isLocked} />}
          {artworkType === 'video' && <ArtisticVideoPanel disabled={isLocked} />}
          {artworkType === 'shape' && <ShapePanel disabled={isLocked} />}
        </ArtworkPanel>
      )}
    </aside>
  )
}

export default RightPanel
