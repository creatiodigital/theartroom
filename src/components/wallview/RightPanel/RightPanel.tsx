'use client'

import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import Tooltip from '@/components/ui/Tooltip/Tooltip'
import { hasAnyPendingUploads } from '@/lib/pendingUploads'
import { openArtworkEditModal } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import { ArtisticImagePanel } from './ArtisticImagePanel'
import { ArtisticSoundPanel } from './ArtisticSoundPanel'
import { ArtisticTextPanel } from './ArtisticTextPanel'
import ArtisticVideoPanel from './ArtisticVideoPanel/ArtisticVideoPanel'
import { ArtworkPanel } from './ArtworkPanel'
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

  // Save first, then open the edit modal
  const handleEditArtworkDetails = async () => {
    if (!currentArtworkId) return

    // Always save to database before opening modal
    // This ensures new artworks and pending image uploads are persisted
    // Check hasAnyPendingUploads() at call time since it's not reactive
    if (hasUnsavedChanges || hasAnyPendingUploads()) {
      const success = await saveToDatabase()
      if (!success) {
        console.error('Failed to save before editing')
        return
      }
    }

    // Open the modal overlay
    dispatch(openArtworkEditModal(currentArtworkId))
  }

  // Determine button label
  const getButtonLabel = () => {
    if (saving) return 'Saving...'
    if (hasUnsavedChanges) return 'View Details'
    return 'View Details'
  }

  return (
    <div
      className={styles.panel}
      data-no-deselect="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={styles.properties}>
        {isGroupCreated && <GroupPanel />}
        {!isGroupCreated && isWizardOpen && currentArtworkId && (
          <>
            <ArtworkPanel />
            {artworkType === 'image' && <ArtisticImagePanel disabled={isLocked} />}
            {artworkType === 'text' && <ArtisticTextPanel disabled={isLocked} />}
            {artworkType === 'sound' && <ArtisticSoundPanel disabled={isLocked} />}
            {artworkType === 'video' && <ArtisticVideoPanel disabled={isLocked} />}
            {artworkType === 'shape' && <ShapePanel disabled={isLocked} />}

            {artworkType !== 'shape' && (
              <div className={styles.editButtonWrapper}>
                <Tooltip
                  label="Clicking will save any pending changes on the current selected artwork"
                  placement="top"
                  fullWidth
                >
                  <Button
                    font="dashboard"
                    size="regular"
                    variant="primary"
                    label={getButtonLabel()}
                    onClick={handleEditArtworkDetails}
                    disabled={saving}
                  />
                </Tooltip>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default RightPanel
