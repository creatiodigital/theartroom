'use client'

import { useSelector } from 'react-redux'

import { Checkbox } from '@/components/ui/Checkbox'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Section } from '@/components/ui/Section/Section'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { Tooltip } from '@/components/ui/Tooltip'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkImageHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkImageHandlers'
import PresetSection from '@/components/wallview/RightPanel/PresetSection/PresetSection'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { RootState } from '@/redux/store'

import {
  frameSizeOptions,
  frameThicknessOptions,
  passepartoutSizeOptions,
  passepartoutThicknessOptions,
  supportThicknessOptions,
} from './constants'

const ArtisticImage = () => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const {
    showFrame,
    showArtworkInformation,
    imageUrl,
    showPassepartout,
    passepartoutColor,
    passepartoutSize,
    passepartoutThickness,
    frameColor,
    frameSize,
    frameThickness,
    frameMaterial,
    frameTextureScale,
    frameTextureOffsetX,
    frameTextureOffsetY,
    frameTextureRotation,
    frameTextureRoughness,
    frameTextureTemperature,
    showSupport,
    supportThickness,
    supportColor,
    hiddenFromExhibition,
    hideShadow,
  } = useArtworkDetails(currentArtworkId!)

  const { handleEditArtisticImage } = useArtworkImageHandlers(currentArtworkId!)

  if (!imageUrl) return null

  return (
    <>
      <Section title="Display">
        <Tooltip
          label="When enabled, visitors can double-click this artwork in the 3D exhibition to view its details"
          placement="left"
        >
          <Checkbox
            checked={showArtworkInformation!}
            onChange={(e) => handleEditArtisticImage('showArtworkInformation', e.target.checked)}
            label="Show information in exhibition"
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
          />
        </Tooltip>

        <Tooltip
          label="When enabled, the drop shadow behind the artwork in the 3D scene will be hidden"
          placement="left"
        >
          <Checkbox
            checked={hideShadow ?? false}
            onChange={(e) => handleEditArtisticImage('hideShadow', e.target.checked)}
            label="Hide shadow"
          />
        </Tooltip>

        <PresetSection presetType="image" />
      </Section>

      <Section title="Presentation">
        <Tooltip
          label="Add the canvas or panel depth behind the artwork (stretcher bars, wood panel, etc.)"
          placement="left"
        >
          <Checkbox
            checked={showSupport!}
            onChange={(e) => handleEditArtisticImage('showSupport', e.target.checked)}
            label="Add Support"
          />
        </Tooltip>
        {showSupport && (
          <div className={styles.controlGroup}>
            <div className={styles.row}>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Support color
                </Text>
                <ColorPicker
                  textColor={supportColor!}
                  onColorSelect={(value) => handleEditArtisticImage('supportColor', value)}
                />
              </div>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Thickness (cm)
                </Text>
                <Select<number>
                  options={supportThicknessOptions}
                  value={supportThickness?.value}
                  onChange={(val) =>
                    handleEditArtisticImage('supportThickness', {
                      label: String(val),
                      value: val,
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}

        <Tooltip
          label="Add a picture frame around this artwork, visible in the 3D exhibition"
          placement="left"
        >
          <Checkbox
            checked={showFrame!}
            onChange={(e) => handleEditArtisticImage('showFrame', e.target.checked)}
            label="Add Frame"
          />
        </Tooltip>
        {showFrame && (
          <div className={styles.controlGroup}>
            <div className={styles.row}>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Material
                </Text>
                <Select<string>
                  options={[
                    { label: 'Plastic', value: 'plastic' },
                    { label: 'Wood', value: 'wood' },
                  ]}
                  value={frameMaterial ?? 'plastic'}
                  onChange={(value) => handleEditArtisticImage('frameMaterial', value)}
                />
              </div>
            </div>
            {/* Plastic controls */}
            {(frameMaterial ?? 'plastic') === 'plastic' && (
              <>
                <div className={styles.row}>
                  <div className={styles.item}>
                    <Text font="dashboard" as="span" size="xs" className={styles.label}>
                      Color
                    </Text>
                    <ColorPicker
                      textColor={frameColor!}
                      onColorSelect={(value) => handleEditArtisticImage('frameColor', value)}
                    />
                  </div>
                </div>
                <div className={styles.item}>
                  <div className={styles.sliderHeader}>
                    <Text font="dashboard" as="span" size="xs" className={styles.label}>Reflections</Text>
                    <span className={styles.sliderValue}>{(frameTextureRoughness ?? 0.6).toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.01"
                    value={frameTextureRoughness ?? 0.6}
                    onChange={(e) => handleEditArtisticImage('frameTextureRoughness', parseFloat(e.target.value))}
                    className={styles.slider}
                  />
                </div>
              </>
            )}
            {/* Wood controls */}
            {frameMaterial === 'wood' && (
              <>
                <div className={styles.item}>
                  <div className={styles.sliderHeader}>
                    <Text font="dashboard" as="span" size="xs" className={styles.label}>Scale</Text>
                    <span className={styles.sliderValue}>{(frameTextureScale ?? 2).toFixed(1)}</span>
                  </div>
                  <input
                    type="range" min="0.5" max="8" step="0.1"
                    value={frameTextureScale ?? 2}
                    onChange={(e) => handleEditArtisticImage('frameTextureScale', parseFloat(e.target.value))}
                    className={styles.slider}
                  />
                </div>
                <div className={styles.item}>
                  <div className={styles.sliderHeader}>
                    <Text font="dashboard" as="span" size="xs" className={styles.label}>Offset X</Text>
                    <span className={styles.sliderValue}>{(frameTextureOffsetX ?? 0).toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.01"
                    value={frameTextureOffsetX ?? 0}
                    onChange={(e) => handleEditArtisticImage('frameTextureOffsetX', parseFloat(e.target.value))}
                    className={styles.slider}
                  />
                </div>
                <div className={styles.item}>
                  <div className={styles.sliderHeader}>
                    <Text font="dashboard" as="span" size="xs" className={styles.label}>Offset Y</Text>
                    <span className={styles.sliderValue}>{(frameTextureOffsetY ?? 0).toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.01"
                    value={frameTextureOffsetY ?? 0}
                    onChange={(e) => handleEditArtisticImage('frameTextureOffsetY', parseFloat(e.target.value))}
                    className={styles.slider}
                  />
                </div>
                <div className={styles.item}>
                  <div className={styles.sliderHeader}>
                    <Text font="dashboard" as="span" size="xs" className={styles.label}>Rotation</Text>
                    <span className={styles.sliderValue}>{(frameTextureRotation ?? 0).toFixed(0)}°</span>
                  </div>
                  <input
                    type="range" min="0" max="360" step="1"
                    value={frameTextureRotation ?? 0}
                    onChange={(e) => handleEditArtisticImage('frameTextureRotation', parseFloat(e.target.value))}
                    className={styles.slider}
                  />
                </div>
                <div className={styles.item}>
                  <div className={styles.sliderHeader}>
                    <Text font="dashboard" as="span" size="xs" className={styles.label}>Temperature</Text>
                    <span className={styles.sliderValue}>{(frameTextureTemperature ?? 0).toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="-1" max="1" step="0.05"
                    value={frameTextureTemperature ?? 0}
                    onChange={(e) => handleEditArtisticImage('frameTextureTemperature', parseFloat(e.target.value))}
                    className={styles.slider}
                  />
                </div>
                <div className={styles.item}>
                  <div className={styles.sliderHeader}>
                    <Text font="dashboard" as="span" size="xs" className={styles.label}>Reflections</Text>
                    <span className={styles.sliderValue}>{(frameTextureRoughness ?? 0.6).toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.01"
                    value={frameTextureRoughness ?? 0.6}
                    onChange={(e) => handleEditArtisticImage('frameTextureRoughness', parseFloat(e.target.value))}
                    className={styles.slider}
                  />
                </div>
              </>
            )}
            <div className={styles.row}>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Size (cm)
                </Text>
                <Select<number>
                  options={frameSizeOptions}
                  value={frameSize?.value}
                  onChange={(val) =>
                    handleEditArtisticImage('frameSize', {
                      label: String(val),
                      value: val,
                    })
                  }
                />
              </div>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Thickness (cm)
                </Text>
                <Select<number>
                  options={frameThicknessOptions}
                  value={frameThickness?.value}
                  onChange={(val) =>
                    handleEditArtisticImage('frameThickness', {
                      label: String(val),
                      value: val,
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}

        <Tooltip
          label="Add a mat border between the artwork and frame, like traditional gallery framing"
          placement="left"
        >
          <Checkbox
            checked={showPassepartout!}
            onChange={(e) => handleEditArtisticImage('showPassepartout', e.target.checked)}
            label="Add Passepartout"
          />
        </Tooltip>
        {showPassepartout && (
          <div className={styles.controlGroup}>
            <div className={styles.row}>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Passepartout color
                </Text>
                <ColorPicker
                  textColor={passepartoutColor!}
                  onColorSelect={(value) => handleEditArtisticImage('passepartoutColor', value)}
                />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Size (cm)
                </Text>
                <Select<number>
                  options={passepartoutSizeOptions}
                  value={passepartoutSize?.value}
                  onChange={(val) =>
                    handleEditArtisticImage('passepartoutSize', {
                      label: String(val),
                      value: val,
                    })
                  }
                />
              </div>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Thickness (cm)
                </Text>
                <Select<number>
                  options={passepartoutThicknessOptions}
                  value={passepartoutThickness?.value}
                  onChange={(val) =>
                    handleEditArtisticImage('passepartoutThickness', {
                      label: String(val),
                      value: val,
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}
      </Section>
    </>
  )
}

export default ArtisticImage
