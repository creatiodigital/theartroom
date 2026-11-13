'use client'

import { useSelector } from 'react-redux'

import { SliderRow, SwitchRow } from '@/components/editorChrome'
import { NumberField, PanelGroup, SelectField } from '@/components/wallview/chrome'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkVideoHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkVideoHandlers'
import PresentationSection from '@/components/wallview/RightPanel/PresentationSection/PresentationSection'
import type { RootState } from '@/redux/store'

// Today's values; the labels in sentence case.
const playModeOptions = [
  { label: 'Play on proximity', value: 'proximity' },
  { label: 'Always play', value: 'always' },
  { label: 'Play on click', value: 'click' },
]

const ArtisticVideoPanel = ({ disabled }: { disabled?: boolean }) => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const {
    videoPlayMode,
    videoLoop,
    videoVolume,
    videoProximityDistance,
    soundSpatial,
    soundDistance,
    // Presentation
    showSupport,
    supportColor,
    supportThickness,
    showFrame,
    frameColor,
    frameSize,
    frameThickness,
    frameMaterial,
    frameCornerStyle,
    frameTextureScale,
    frameTextureRotation,
    frameTextureRoughness,
    frameTextureNormalScale,
    showPassepartout,
    passepartoutColor,
    passepartoutSize,
    passepartoutThickness,
    showPaperBorder,
    paperBorderSize,
    hideShadow,
  } = useArtworkDetails(currentArtworkId!)

  const { handleEditVideo } = useArtworkVideoHandlers(currentArtworkId!)

  return (
    <>
      <PresentationSection
        disabled={disabled}
        showSupport={showSupport!}
        supportColor={supportColor!}
        supportThickness={supportThickness}
        showFrame={showFrame!}
        frameColor={frameColor!}
        frameSize={frameSize}
        frameThickness={frameThickness}
        frameMaterial={frameMaterial}
        frameCornerStyle={frameCornerStyle}
        frameTextureScale={frameTextureScale}
        frameTextureRotation={frameTextureRotation}
        frameTextureRoughness={frameTextureRoughness}
        frameTextureNormalScale={frameTextureNormalScale}
        showPassepartout={showPassepartout!}
        passepartoutColor={passepartoutColor!}
        passepartoutSize={passepartoutSize}
        passepartoutThickness={passepartoutThickness}
        // Q146 (f): read back what the switch saves (the 2D wall draws it on a video with a poster;
        // the 3D room draws no video paper border, Q154).
        showPaperBorder={showPaperBorder}
        paperBorderSize={paperBorderSize}
        hideShadow={hideShadow}
        onEdit={handleEditVideo}
      />

      <PanelGroup title="Video properties" disabled={disabled}>
        <SelectField<string>
          label="Play mode"
          options={playModeOptions}
          value={videoPlayMode}
          onChange={(val) =>
            handleEditVideo('videoPlayMode', val as 'proximity' | 'always' | 'click')
          }
        />

        <SwitchRow
          title="Loop"
          checked={videoLoop ?? true}
          onChange={(e) => handleEditVideo('videoLoop', e.target.checked)}
        />

        <SliderRow
          label="Volume"
          value={`${Math.round((videoVolume ?? 1) * 100)}%`}
          sliderValue={videoVolume ?? 1}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => handleEditVideo('videoVolume', v)}
          disabled={disabled}
        />

        {/* Proximity Distance — only shown in proximity mode */}
        {videoPlayMode === 'proximity' && (
          <NumberField
            label="Proximity distance"
            suffix="cm"
            value={Math.round((videoProximityDistance ?? 3) * 100)}
            min={100}
            max={5000}
            onChange={(e) =>
              handleEditVideo('videoProximityDistance', Number(e.target.value) / 100)
            }
          />
        )}

        <SwitchRow
          title="Spatial sound"
          checked={soundSpatial ?? true}
          onChange={(e) => handleEditVideo('soundSpatial', e.target.checked)}
        />

        {/* Sound Distance — only visible when spatial is on */}
        {soundSpatial && (
          <NumberField
            label="Sound distance"
            suffix="cm"
            value={Math.round((soundDistance ?? 5) * 100)}
            min={100}
            max={5000}
            onChange={(e) => handleEditVideo('soundDistance', Number(e.target.value) / 100)}
          />
        )}
      </PanelGroup>
    </>
  )
}

export default ArtisticVideoPanel
