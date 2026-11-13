'use client'

import { ColorPicker } from '@/components/ui/ColorPicker'
import { PanelCard, SliderRow, SwitchRow } from '@/components/editorChrome'
import { PanelGroup, SelectField } from '@/components/wallview/chrome'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import { PASSEPARTOUT_THICKNESS } from '@/lib/passepartoutThickness'
import type { TArtwork } from '@/types/artwork'

// Today's options and values; the labels in sentence case.
const FRAME_MATERIALS = [
  { label: 'Plastic', value: 'plastic' },
  { label: 'Light wood', value: 'wood-light' },
  { label: 'Medium wood', value: 'wood-medium' },
  { label: 'Dark wood', value: 'wood-dark' },
]

const FRAME_CORNERS = [
  { label: 'Mitered', value: 'mitered' },
  { label: 'Straight', value: 'straight' },
]

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
  showPaperBorder?: boolean
  paperBorderSize?: { label: string; value: number }
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
  showPaperBorder,
  paperBorderSize,
  hideShadow,
  onEdit,
  showShadowControl = true,
}: PresentationSectionProps) => {
  // wallview.md §3 "How it hangs" (designs/wall-view-panels.dc.html): one card per finish, its
  // switch first and its options inside while on, in the drawn order (Frame, Passepartout, Paper
  // border, Support; before: Support first). Every value, range and handler is today's.
  return (
    <PanelGroup title="How it hangs" disabled={disabled}>
      <PanelCard level="card">
        <SwitchRow
          title="Frame"
          line="A picture frame, visible in the 3D room"
          checked={showFrame!}
          onChange={(e) => onEdit('showFrame', e.target.checked)}
          disabled={disabled}
        />
        {showFrame && (
          <>
            <div className={styles.grid2}>
              <SelectField<string>
                label="Material"
                options={FRAME_MATERIALS}
                value={frameMaterial ?? 'plastic'}
                onChange={(value) => onEdit('frameMaterial', value)}
                disabled={disabled}
              />
              <SelectField<string>
                label="Corner"
                options={FRAME_CORNERS}
                value={frameCornerStyle ?? 'mitered'}
                onChange={(value) => onEdit('frameCornerStyle', value)}
                disabled={disabled}
              />
            </div>
            {/* Plastic controls */}
            {(frameMaterial ?? 'plastic') === 'plastic' && (
              <>
                <ColorPicker
                  variant="inline"
                  name="Plastic color"
                  textColor={frameColor!}
                  onColorSelect={(value) => onEdit('frameColor', value)}
                  disabled={disabled}
                />
                <SliderRow
                  label="Roughness"
                  value={(frameTextureRoughness ?? 0.6).toFixed(2)}
                  sliderValue={frameTextureRoughness ?? 0.6}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => onEdit('frameTextureRoughness', v)}
                  disabled={disabled}
                />
              </>
            )}
            {/* Wood controls */}
            {frameMaterial?.startsWith('wood') && (
              <>
                <SwitchRow
                  title="Paint"
                  checked={!!frameColor && frameColor !== '#ffffff'}
                  onChange={(e) => onEdit('frameColor', e.target.checked ? '#000000' : '#ffffff')}
                  disabled={disabled}
                />
                {frameColor && frameColor !== '#ffffff' && (
                  <ColorPicker
                    variant="inline"
                    name="Wood color"
                    textColor={frameColor}
                    onColorSelect={(value) => onEdit('frameColor', value)}
                    disabled={disabled}
                  />
                )}
                <SliderRow
                  label="Scale"
                  value={(frameTextureScale ?? 2).toFixed(1)}
                  sliderValue={frameTextureScale ?? 2}
                  min={0.1}
                  max={8}
                  step={0.1}
                  onChange={(v) => onEdit('frameTextureScale', v)}
                  disabled={disabled}
                />
                <SliderRow
                  label="Rotation"
                  value={`${(frameTextureRotation ?? 0).toFixed(0)}°`}
                  sliderValue={frameTextureRotation ?? 0}
                  min={0}
                  max={360}
                  step={1}
                  onChange={(v) => onEdit('frameTextureRotation', v)}
                  disabled={disabled}
                />
                <SliderRow
                  label="Roughness"
                  value={(frameTextureRoughness ?? 0.6).toFixed(2)}
                  sliderValue={frameTextureRoughness ?? 0.6}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => onEdit('frameTextureRoughness', v)}
                  disabled={disabled}
                />
                <SliderRow
                  label="Details"
                  value={(frameTextureNormalScale ?? 0.5).toFixed(2)}
                  sliderValue={frameTextureNormalScale ?? 0.5}
                  min={0.1}
                  max={1}
                  step={0.01}
                  onChange={(v) => onEdit('frameTextureNormalScale', v)}
                  disabled={disabled}
                />
              </>
            )}
            <SliderRow
              label="Size"
              aria-label="Frame size"
              value={`${frameSize?.value ?? 3} cm`}
              sliderValue={frameSize?.value ?? 3}
              min={1}
              max={20}
              step={1}
              onChange={(v) =>
                onEdit('frameSize', {
                  label: String(v),
                  value: v,
                })
              }
              disabled={disabled}
            />
            <SliderRow
              label="Thickness"
              aria-label="Frame thickness"
              value={`${frameThickness?.value ?? 2} cm`}
              sliderValue={frameThickness?.value ?? 2}
              min={1}
              max={20}
              step={1}
              onChange={(v) =>
                onEdit('frameThickness', {
                  label: String(v),
                  value: v,
                })
              }
              disabled={disabled}
            />
          </>
        )}
      </PanelCard>

      <PanelCard level="card">
        <SwitchRow
          title="Passepartout"
          line="A mat border between artwork and frame"
          checked={showPassepartout!}
          onChange={(e) => onEdit('showPassepartout', e.target.checked)}
          disabled={disabled}
        />
        {showPassepartout && (
          <>
            <ColorPicker
              variant="inline"
              name="Passepartout color"
              textColor={passepartoutColor!}
              onColorSelect={(value) => onEdit('passepartoutColor', value)}
              disabled={disabled}
            />
            <SliderRow
              label="Size"
              aria-label="Passepartout size"
              value={`${passepartoutSize?.value ?? 3} cm`}
              sliderValue={passepartoutSize?.value ?? 3}
              min={1}
              max={20}
              step={1}
              onChange={(v) =>
                onEdit('passepartoutSize', {
                  label: String(v),
                  value: v,
                })
              }
              disabled={disabled}
            />
            <SliderRow
              label="Thickness"
              aria-label="Passepartout thickness"
              value={`${(passepartoutThickness?.value ?? 1).toFixed(1)} cm`}
              sliderValue={passepartoutThickness?.value ?? 1}
              min={PASSEPARTOUT_THICKNESS.min}
              max={PASSEPARTOUT_THICKNESS.max}
              step={0.1}
              onChange={(v) =>
                onEdit('passepartoutThickness', {
                  label: String(v),
                  value: v,
                })
              }
              disabled={disabled}
            />
          </>
        )}
      </PanelCard>

      <PanelCard level="card">
        <SwitchRow
          title="Paper border"
          line="A white margin around the print"
          checked={showPaperBorder ?? false}
          onChange={(e) => onEdit('showPaperBorder', e.target.checked)}
          disabled={disabled}
        />
        {showPaperBorder && (
          <SliderRow
            label="Size"
            aria-label="Paper border size"
            value={`${paperBorderSize?.value ?? 0} cm`}
            sliderValue={paperBorderSize?.value ?? 0}
            min={0}
            max={10}
            step={1}
            onChange={(v) =>
              onEdit('paperBorderSize', {
                label: String(v),
                value: v,
              })
            }
            disabled={disabled}
          />
        )}
      </PanelCard>

      <PanelCard level="card">
        <SwitchRow
          title="Support"
          line="Canvas or panel depth behind the work"
          checked={showSupport!}
          onChange={(e) => onEdit('showSupport', e.target.checked)}
          disabled={disabled}
        />
        {showSupport && (
          <>
            <ColorPicker
              variant="inline"
              name="Support color"
              textColor={supportColor!}
              onColorSelect={(value) => onEdit('supportColor', value)}
              disabled={disabled}
            />
            <SliderRow
              label="Thickness"
              aria-label="Support thickness"
              value={`${(supportThickness?.value ?? 2).toFixed(1)} cm`}
              sliderValue={supportThickness?.value ?? 2}
              min={0}
              max={10}
              step={0.1}
              onChange={(v) =>
                onEdit('supportThickness', {
                  label: String(v),
                  value: v,
                })
              }
              disabled={disabled}
            />
          </>
        )}
      </PanelCard>

      {showShadowControl && (
        <PanelCard level="card">
          <SwitchRow
            title="Hide shadow"
            line="No drop shadow behind it in 3D"
            checked={hideShadow ?? false}
            onChange={(e) => onEdit('hideShadow', e.target.checked)}
            disabled={disabled}
          />
        </PanelCard>
      )}
    </PanelGroup>
  )
}

export default PresentationSection
