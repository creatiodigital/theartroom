'use client'

import { useSelector } from 'react-redux'
import { EyeSlash } from '@phosphor-icons/react'

import { PanelCard, SwitchRow } from '@/components/editorChrome'
import { PanelGroup } from '@/components/wallview/chrome'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkImageHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkImageHandlers'
import PresentationSection from '@/components/wallview/RightPanel/PresentationSection/PresentationSection'
import PresetSection from '@/components/wallview/RightPanel/PresetSection/PresetSection'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'

const ArtisticImage = ({ disabled }: { disabled?: boolean }) => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const {
    showFrame,
    showArtworkInformation,
    imageUrl,
    showPassepartout,
    passepartoutColor,
    passepartoutSize,
    passepartoutThickness,
    showPaperBorder,
    paperBorderSize,
    frameColor,
    frameSize,
    frameThickness,
    frameMaterial,
    frameCornerStyle,
    frameTextureScale,
    frameTextureRotation,
    frameTextureRoughness,
    frameTextureNormalScale,
    showSupport,
    supportThickness,
    supportColor,
    hiddenFromExhibition,
    hideShadow,
    showOnPage,
  } = useArtworkDetails(currentArtworkId!)

  const { handleEditArtisticImage } = useArtworkImageHandlers(currentArtworkId!)

  if (!imageUrl) return null

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
        showPaperBorder={showPaperBorder}
        paperBorderSize={paperBorderSize}
        hideShadow={hideShadow}
        onEdit={handleEditArtisticImage}
        showShadowControl={false}
      />

      <PanelGroup title="In the exhibition" disabled={disabled}>
        <PanelCard level="card">
          <SwitchRow
            title="Show information"
            line="Visitors double-click to see details"
            checked={showArtworkInformation!}
            onChange={(e) => handleEditArtisticImage('showArtworkInformation', e.target.checked)}
            disabled={disabled}
          />
        </PanelCard>
        <PanelCard level="card">
          <SwitchRow
            title="Hide on the exhibition page"
            line="Only in the 3D room, not in the list"
            checked={hiddenFromExhibition ?? false}
            onChange={(e) => handleEditArtisticImage('hiddenFromExhibition', e.target.checked)}
            disabled={disabled}
          />
          {/* Hung in the room but deliberately off the exhibition page. A
              legitimate state, and a rare one — so it should read as a
              decision, not as something forgotten. */}
          {!showOnPage && (
            <p className={styles.offPage}>
              <EyeSlash size={14} weight="light" aria-hidden />
              Not shown on the exhibition page
            </p>
          )}
        </PanelCard>
        <PanelCard level="card">
          <SwitchRow
            title="Hide shadow"
            line="No drop shadow behind it in 3D"
            checked={hideShadow ?? false}
            onChange={(e) => handleEditArtisticImage('hideShadow', e.target.checked)}
            disabled={disabled}
          />
        </PanelCard>
      </PanelGroup>

      <PanelGroup title="Preset" disabled={disabled}>
        <PresetSection presetType="image" />
      </PanelGroup>
    </>
  )
}

export default ArtisticImage
