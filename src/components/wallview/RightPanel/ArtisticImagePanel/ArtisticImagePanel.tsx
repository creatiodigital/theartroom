'use client'

import { useSelector } from 'react-redux'

import { Checkbox } from '@/components/ui/Checkbox'
import { Icon } from '@/components/ui/Icon'
import { Section } from '@/components/ui/Section/Section'
import { Tooltip } from '@/components/ui/Tooltip'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkImageHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkImageHandlers'
import PresentationSection from '@/components/wallview/RightPanel/PresentationSection/PresentationSection'
import PresetSection from '@/components/wallview/RightPanel/PresetSection/PresetSection'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import type { RootState } from '@/redux/store'

import styles from './ArtisticImage.module.scss'

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
      <Section title="Display" disabled={disabled}>
        <Tooltip
          label="When enabled, visitors can double-click this artwork in the 3D exhibition to view its details"
          placement="left"
        >
          <Checkbox
            checked={showArtworkInformation!}
            onChange={(e) => handleEditArtisticImage('showArtworkInformation', e.target.checked)}
            label="Show information in exhibition"
            disabled={disabled}
          />
        </Tooltip>

        <Tooltip
          label="When enabled, this artwork won't appear in the exhibition's artwork grid on the public page"
          placement="left"
        >
          <Checkbox
            checked={hiddenFromExhibition ?? false}
            onChange={(e) => handleEditArtisticImage('hiddenFromExhibition', e.target.checked)}
            label="Hide in exhibition page"
            disabled={disabled}
          />
        </Tooltip>

        {/* Hung in the room but deliberately off the exhibition page. A
            legitimate state, and a rare one — so it should read as a
            decision, not as something forgotten. */}
        {!showOnPage && (
          <span className={styles.offPageMarker}>
            <Icon name="eyeOff" size={14} strokeWidth={ICON_STROKE_WIDTH} />
            Not shown on the exhibition page
          </span>
        )}

        <Tooltip
          label="When enabled, the drop shadow behind the artwork in the 3D scene will be hidden"
          placement="left"
        >
          <Checkbox
            checked={hideShadow ?? false}
            onChange={(e) => handleEditArtisticImage('hideShadow', e.target.checked)}
            label="Hide shadow"
            disabled={disabled}
          />
        </Tooltip>

        <PresetSection presetType="image" />
      </Section>

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
    </>
  )
}

export default ArtisticImage
