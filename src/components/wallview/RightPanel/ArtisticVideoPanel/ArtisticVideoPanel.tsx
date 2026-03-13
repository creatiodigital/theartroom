'use client'

import { useSelector } from 'react-redux'

import { NumberInput } from '@/components/ui/NumberInput'
import { Section } from '@/components/ui/Section/Section'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkVideoHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkVideoHandlers'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'

const playModeOptions = [
  { label: 'Play Once', value: 'play-once' },
  { label: 'Loop', value: 'loop' },
]

const ArtisticVideoPanel = ({ disabled }: { disabled?: boolean }) => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const {
    videoPlayMode,
    videoProximityDistance,
  } = useArtworkDetails(currentArtworkId!)

  const { handleEditVideo } = useArtworkVideoHandlers(currentArtworkId!)

  return (
    <>
      {/* Video Properties */}
      <Section title="Video Properties" disabled={disabled}>
        {/* Play Mode Selector */}
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Play Mode
            </Text>
            <Select<string>
              options={playModeOptions}
              value={videoPlayMode}
              onChange={(val) => handleEditVideo('videoPlayMode', val as 'loop' | 'play-once')}
            />
          </div>
        </div>

        {/* Proximity Distance */}
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Proximity Distance (m)
            </Text>
            <NumberInput
              value={videoProximityDistance ?? 3}
              min={1}
              max={50}
              onChange={(e) => handleEditVideo('videoProximityDistance', Number(e.target.value))}
            />
          </div>
        </div>
      </Section>
    </>
  )
}

export default ArtisticVideoPanel
