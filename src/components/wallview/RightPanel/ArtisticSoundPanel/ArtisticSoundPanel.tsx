'use client'

import { useSelector } from 'react-redux'

import { SwitchRow } from '@/components/editorChrome'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { NumberField, PanelGroup, SelectField } from '@/components/wallview/chrome'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkSoundHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkSoundHandlers'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'

// Today's values (stored sound icons are 'volume-2' / 'headphones'); labels in sentence case.
const iconOptions = [
  { label: 'Volume', value: 'volume-2' },
  { label: 'Headphones', value: 'headphones' },
]

const playModeOptions = [
  { label: 'Play once', value: 'play-once' },
  { label: 'Loop', value: 'loop' },
]

const ArtisticSoundPanel = ({ disabled }: { disabled?: boolean }) => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const {
    soundIcon,
    soundPlayMode,
    soundSpatial,
    soundDistance,
    soundBackgroundColor,
    soundIconColor,
    soundIconSize,
  } = useArtworkDetails(currentArtworkId!)

  const { handleEditSound } = useArtworkSoundHandlers(currentArtworkId!)

  return (
    <>
      <PanelGroup title="Playback" disabled={disabled}>
        <SelectField<string>
          label="Icon"
          options={iconOptions}
          value={soundIcon}
          onChange={(val) => handleEditSound('soundIcon', val)}
        />
        <SelectField<string>
          label="Play mode"
          options={playModeOptions}
          value={soundPlayMode}
          onChange={(val) => handleEditSound('soundPlayMode', val as 'loop' | 'play-once')}
        />

        <SwitchRow
          title="Positional sound"
          checked={soundSpatial ?? true}
          onChange={(e) => handleEditSound('soundSpatial', e.target.checked)}
        />

        {/* Distance control — only visible when positional is on */}
        {soundSpatial && (
          <NumberField
            label="Distance"
            suffix="cm"
            value={Math.round((soundDistance ?? 5) * 100)}
            min={100}
            max={5000}
            onChange={(e) => handleEditSound('soundDistance', Number(e.target.value) / 100)}
          />
        )}
      </PanelGroup>

      <PanelGroup title="Appearance" disabled={disabled}>
        <div className={styles.grid2}>
          <ColorPicker
            variant="field"
            name="Icon color"
            textColor={soundIconColor ?? '#000000'}
            onColorSelect={(value) => handleEditSound('soundIconColor', value)}
          />
          <div className={styles.colorWithNone}>
            <ColorPicker
              variant="field"
              name="Background"
              textColor={soundBackgroundColor ?? '#ffffff'}
              onColorSelect={(value) => handleEditSound('soundBackgroundColor', value)}
              emptyLabel={soundBackgroundColor == null ? 'None' : undefined}
            />
            <Button
              variant="bare"
              font="dashboard"
              className={styles.link}
              aria-pressed={soundBackgroundColor == null}
              aria-label="Background: none"
              onClick={() => handleEditSound('soundBackgroundColor', null)}
            >
              None
            </Button>
          </div>
        </div>

        <NumberField
          label="Icon size"
          value={soundIconSize ?? 24}
          min={8}
          max={128}
          onChange={(e) => handleEditSound('soundIconSize', Number(e.target.value))}
        />
      </PanelGroup>
    </>
  )
}

export default ArtisticSoundPanel
