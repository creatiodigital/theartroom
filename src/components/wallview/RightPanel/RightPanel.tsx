import { useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import type { RootState } from '@/redux/store'

import { ArtisticImagePanel } from './ArtisticImagePanel'
import { ArtisticTextPanel } from './ArtisticTextPanel'
import { ArtworkPanel } from './ArtworkPanel'
import { GroupPanel } from './GroupPanel'
import { useArtworkDetails } from './hooks/useArtworkDetails'
import styles from './RightPanel.module.scss'

const RightPanel = () => {
  const isWizardOpen = useSelector((state: RootState) => state.wizard.isWizardOpen)
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)

  const { artworkType } = useArtworkDetails(currentArtworkId!)

  const isGroupCreated = artworkGroupIds.length > 1

  return (
    <div
      className={styles.panel}
      data-no-deselect="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={styles.properties}>
        {isGroupCreated && <GroupPanel />}
        {!isGroupCreated && isWizardOpen && (
          <>
            <ArtworkPanel />
            {artworkType === 'image' && <ArtisticImagePanel />}
            {artworkType === 'text' && <ArtisticTextPanel />}

            <div className={styles.editButtonWrapper}>
              <Button
                font="dashboard"
                size="small"
                variant="primary"
                label="Edit Artwork Details"
                href={`/dashboard/artworks/${currentArtworkId}/edit?returnUrl=${encodeURIComponent(window.location.pathname)}`}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default RightPanel
