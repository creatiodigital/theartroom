'use client'

import { Checkbox } from '@/components/ui/Checkbox'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Section } from '@/components/ui/Section/Section'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { Tooltip } from '@/components/ui/Tooltip'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import type { TArtwork } from '@/types/artwork'

import {
  frameSizeOptions,
  frameThicknessOptions,
  passepartoutSizeOptions,
  passepartoutThicknessOptions,
  supportThicknessOptions,
} from './constants'

type PresentationSectionProps = {
  disabled?: boolean
  showSupport: boolean
  supportColor: string
  supportThickness?: { label: string; value: number }
  showFrame: boolean
  frameColor: string
  frameSize?: { label: string; value: number }
  frameThickness?: { label: string; value: number }
  frameMaterial?: string
  frameCornerStyle?: string
  frameTextureScale?: number
  frameTextureRotation?: number
  frameTextureRoughness?: number
  frameTextureNormalScale?: number
  showPassepartout: boolean
  passepartoutColor: string
  passepartoutSize?: { label: string; value: number }
  passepartoutThickness?: { label: string; value: number }
  hideShadow?: boolean
  onEdit: <K extends keyof TArtwork>(property: K, value: TArtwork[K]) => void
  /** Whether to show the "Hide shadow" checkbox (default: true) */
  showShadowControl?: boolean
}

const PresentationSection = ({
  disabled,
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
  hideShadow,
  onEdit,
  showShadowControl = true,
}: PresentationSectionProps) => {
  return (
    <Section title="Presentation" disabled={disabled}>
      <Tooltip
        label="Add the canvas or panel depth behind the artwork (stretcher bars, wood panel, etc.)"
        placement="left"
      >
        <Checkbox
          checked={showSupport!}
          onChange={(e) => onEdit('showSupport', e.target.checked)}
          label="Add Support"
          disabled={disabled}
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
                onColorSelect={(value) => onEdit('supportColor', value)}
                disabled={disabled}
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
                  onEdit('supportThickness', {
                    label: String(val),
                    value: val,
                  })
                }
                disabled={disabled}
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
          onChange={(e) => onEdit('showFrame', e.target.checked)}
          label="Add Frame"
          disabled={disabled}
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
                  { label: 'Light Wood', value: 'wood-light' },
                  { label: 'Medium Wood', value: 'wood-medium' },
                  { label: 'Dark Wood', value: 'wood-dark' },
                ]}
                value={frameMaterial ?? 'plastic'}
                onChange={(value) => onEdit('frameMaterial', value)}
                disabled={disabled}
              />
            </div>
            <div className={styles.item}>
              <Text font="dashboard" as="span" size="xs" className={styles.label}>
                Corner
              </Text>
              <Select<string>
                options={[
                  { label: 'Mitered', value: 'mitered' },
                  { label: 'Straight', value: 'straight' },
                ]}
                value={frameCornerStyle ?? 'mitered'}
                onChange={(value) => onEdit('frameCornerStyle', value)}
                disabled={disabled}
              />
            </div>
          </div>
          {/* Plastic controls */}
          {(frameMaterial ?? 'plastic') === 'plastic' && (
            <>
              <div className={styles.row}>
                <div className={styles.item}>
                  <Text font="dashboard" as="span" size="xs" className={styles.label}>
                    Plastic Color
                  </Text>
                  <ColorPicker
                    textColor={frameColor!}
                    onColorSelect={(value) => onEdit('frameColor', value)}
                    disabled={disabled}
                  />
                </div>
              </div>
              <div className={styles.item}>
                <div className={styles.sliderHeader}>
                  <Text font="dashboard" as="span" size="xs" className={styles.label}>
                    Reflections
                  </Text>
                  <span className={styles.sliderValue}>
                    {(frameTextureRoughness ?? 0.6).toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={frameTextureRoughness ?? 0.6}
                  onChange={(e) => onEdit('frameTextureRoughness', parseFloat(e.target.value))}
                  className={styles.slider}
                  disabled={disabled}
                  style={disabled ? { opacity: 0.5 } : undefined}
                />
              </div>
            </>
          )}
          {/* Wood controls */}
          {frameMaterial?.startsWith('wood') && (
            <>
              <div className={styles.row}>
                <div className={styles.item}>
                  <Checkbox
                    checked={!!frameColor && frameColor !== '#ffffff'}
                    onChange={(e) => onEdit('frameColor', e.target.checked ? '#000000' : '#ffffff')}
                    label="Paint"
                    disabled={disabled}
                  />
                </div>
              </div>
              {frameColor && frameColor !== '#ffffff' && (
                <div className={styles.row}>
                  <div className={styles.item}>
                    <Text font="dashboard" as="span" size="xs" className={styles.label}>
                      Wood Color
                    </Text>
                    <ColorPicker
                      textColor={frameColor}
                      onColorSelect={(value) => onEdit('frameColor', value)}
                      disabled={disabled}
                    />
                  </div>
                </div>
              )}
              <div className={styles.item}>
                <div className={styles.sliderHeader}>
                  <Text font="dashboard" as="span" size="xs" className={styles.label}>
                    Scale
                  </Text>
                  <span className={styles.sliderValue}>{(frameTextureScale ?? 2).toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="8"
                  step="0.1"
                  value={frameTextureScale ?? 2}
                  onChange={(e) => onEdit('frameTextureScale', parseFloat(e.target.value))}
                  className={styles.slider}
                  disabled={disabled}
                  style={disabled ? { opacity: 0.5 } : undefined}
                />
              </div>
              <div className={styles.item}>
                <div className={styles.sliderHeader}>
                  <Text font="dashboard" as="span" size="xs" className={styles.label}>
                    Rotation
                  </Text>
                  <span className={styles.sliderValue}>
                    {(frameTextureRotation ?? 0).toFixed(0)}°
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={frameTextureRotation ?? 0}
                  onChange={(e) => onEdit('frameTextureRotation', parseFloat(e.target.value))}
                  className={styles.slider}
                  disabled={disabled}
                  style={disabled ? { opacity: 0.5 } : undefined}
                />
              </div>
              <div className={styles.item}>
                <div className={styles.sliderHeader}>
                  <Text font="dashboard" as="span" size="xs" className={styles.label}>
                    Reflections
                  </Text>
                  <span className={styles.sliderValue}>
                    {(frameTextureRoughness ?? 0.6).toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={frameTextureRoughness ?? 0.6}
                  onChange={(e) => onEdit('frameTextureRoughness', parseFloat(e.target.value))}
                  className={styles.slider}
                  disabled={disabled}
                  style={disabled ? { opacity: 0.5 } : undefined}
                />
              </div>
              <div className={styles.item}>
                <div className={styles.sliderHeader}>
                  <Text font="dashboard" as="span" size="xs" className={styles.label}>
                    Details
                  </Text>
                  <span className={styles.sliderValue}>
                    {(frameTextureNormalScale ?? 0.5).toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.01"
                  value={frameTextureNormalScale ?? 0.5}
                  onChange={(e) => onEdit('frameTextureNormalScale', parseFloat(e.target.value))}
                  className={styles.slider}
                  disabled={disabled}
                  style={disabled ? { opacity: 0.5 } : undefined}
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
                  onEdit('frameSize', {
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
                  onEdit('frameThickness', {
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
          onChange={(e) => onEdit('showPassepartout', e.target.checked)}
          label="Add Passepartout"
          disabled={disabled}
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
                onColorSelect={(value) => onEdit('passepartoutColor', value)}
                disabled={disabled}
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
                  onEdit('passepartoutSize', {
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
                  onEdit('passepartoutThickness', {
                    label: String(val),
                    value: val,
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {showShadowControl && (
        <Tooltip
          label="When enabled, the drop shadow behind the artwork in the 3D scene will be hidden"
          placement="left"
        >
          <Checkbox
            checked={hideShadow ?? false}
            onChange={(e) => onEdit('hideShadow', e.target.checked)}
            label="Hide shadow"
            disabled={disabled}
          />
        </Tooltip>
      )}
    </Section>
  )
}

export default PresentationSection
