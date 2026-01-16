'use client'

import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { openArtworkEditModal } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import { ArtisticImagePanel } from './ArtisticImagePanel'
import { ArtisticTextPanel } from './ArtisticTextPanel'
import { ArtworkPanel } from './ArtworkPanel'
import { GroupPanel } from './GroupPanel'
import { useArtworkDetails } from './hooks/useArtworkDetails'
import { useSaveExhibition } from '../hooks/useSaveExhibition'
import styles from './RightPanel.module.scss'

const RightPanel = () => {
  const dispatch = useDispatch()
  const isWizardOpen = useSelector((state: RootState) => state.wizard.isWizardOpen)
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  // Check if there are unsaved changes (history or snapshot exist)
  const hasUnsavedChanges = useSelector(
    (state: RootState) => (state.exhibition as { _history: unknown[] })._history.length > 0 || 
                          (state.exhibition as { _snapshot: unknown })._snapshot !== null
  )

  const { artworkType } = useArtworkDetails(currentArtworkId!)
  const { saveToDatabase, saving } = useSaveExhibition()

  const isGroupCreated = artworkGroupIds.length > 1

  // Save first, then open the edit modal
  const handleEditArtworkDetails = async () => {
    if (!currentArtworkId) return
    
    // Save artwork to database first if there are unsaved changes
    if (hasUnsavedChanges) {
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
    if (hasUnsavedChanges) return 'Save and Edit Details'
    return 'Edit Details'
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
            {artworkType === 'image' && <ArtisticImagePanel />}
            {artworkType === 'text' && <ArtisticTextPanel />}

            <div className={styles.editButtonWrapper}>
              <Button
                font="dashboard"
                size="regular"
                variant="primary"
                label={getButtonLabel()}
                onClick={handleEditArtworkDetails}
                disabled={saving}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default RightPanel

