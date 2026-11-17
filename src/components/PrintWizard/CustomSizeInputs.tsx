'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/Input'
import { Slider } from '@/components/ui/Slider'

import { type SizeDimension, type WizardConfig, clampCm } from '@/lib/print-providers'
import { type PrintLongEdgeBounds } from '@/lib/print-providers/printspace'
import { formatDimensions, parseLengthInput, toUnit, type Unit } from '@/lib/units/format'

import styles from './PrintWizard.module.scss'

// Aspect-locked height × width inputs + a long-edge slider. Extracted
// from StepsPanel so the buyer wizard and the dashboard's limited-variant
// editor share ONE implementation (identical clamps, aspect lock and
// range labels). Catalog-agnostic: it takes the `custom` bounds directly
// rather than a full SizeDimension.
interface CustomSizeInputsProps {
  custom: SizeDimension['custom']
  aspectRatio: number
  longEdgeBounds: PrintLongEdgeBounds | null
  customSize: WizardConfig['customSize']
  disabled: boolean
  onChange: (size: { widthCm: number; heightCm: number }) => void
  /** Show the long-edge slider. Default true (buyer wizard / interactive
   *  diagram). The dashboard variant editor passes false — inputs only. */
  showSlider?: boolean
  /** The unit the fields and labels are written in. The buyer's wizard passes the visitor's choice
   *  (units.md); the artist's variant editor leaves it at cm. Whatever is shown, `onChange` and the
   *  clamps work in cm: what is typed is converted, and every field is written from the stored cm,
   *  so switching units never drifts the size. */
  unit?: Unit
}

export const CustomSizeInputs = ({
  custom,
  aspectRatio,
  longEdgeBounds,
  customSize,
  disabled,
  onChange,
  showSlider = true,
  unit = 'cm',
}: CustomSizeInputsProps) => {
  // Hooks must be called unconditionally on every render. We don't
  // bail out on `!custom` until after they've been declared, so the
  // hook order stays stable when the dimension switches between
  // custom-size and preset-size variants.
  const widthCm = customSize?.widthCm ?? 0
  const heightCm = customSize?.heightCm ?? 0
  const stepCmForInit = custom?.stepCm ?? 1
  const fieldText = (cm: number, stepCm: number) =>
    unit === 'cm' ? formatCm(cm, stepCm) : formatInches(cm)
  const [widthInput, setWidthInput] = useState<string>(fieldText(widthCm, stepCmForInit))
  const [heightInput, setHeightInput] = useState<string>(fieldText(heightCm, stepCmForInit))
  const [editing, setEditing] = useState<'width' | 'height' | null>(null)
  // The unit the fields are currently written in, to notice the configurator's switch changing it.
  const [fieldsUnit, setFieldsUnit] = useState<Unit>(unit)

  if (!custom) return null

  if (unit !== fieldsUnit) {
    // The unit changed, maybe with a field still focused (on iPhone a tap on the switch leaves it
    // focused). Re-write both from the stored cm, so the next keystroke is read in the unit it is
    // shown in; `editing` is left alone so typing carries on normally.
    setFieldsUnit(unit)
    setWidthInput(fieldText(widthCm, custom.stepCm))
    setHeightInput(fieldText(heightCm, custom.stepCm))
  } else if (editing === null) {
    // Sync local input with external customSize updates when the user
    // isn't actively typing in either field.
    const wStr = fieldText(widthCm, custom.stepCm)
    const hStr = fieldText(heightCm, custom.stepCm)
    if (wStr !== widthInput) setWidthInput(wStr)
    if (hStr !== heightInput) setHeightInput(hStr)
  }

  const aspectLocked = custom.aspectLocked === true
  const ratioWH = aspectLocked && aspectRatio > 0 ? aspectRatio : null

  const effectiveMinLongCm = longEdgeBounds?.minLongCm ?? custom.minCm
  const effectiveMaxLongCm = longEdgeBounds?.maxLongCm ?? custom.maxCm
  const aspectShortOverLong =
    longEdgeBounds?.aspect ?? (ratioWH !== null ? Math.min(ratioWH, 1 / ratioWH) : 1)
  const isPortrait = longEdgeBounds?.isPortrait ?? (ratioWH !== null && ratioWH < 1)
  const minShortCm = effectiveMinLongCm * aspectShortOverLong
  const maxShortCm = effectiveMaxLongCm * aspectShortOverLong
  const minWidthCm = isPortrait ? minShortCm : effectiveMinLongCm
  const maxWidthCm = isPortrait ? maxShortCm : effectiveMaxLongCm
  const minHeightCm = isPortrait ? effectiveMinLongCm : minShortCm
  const maxHeightCm = isPortrait ? effectiveMaxLongCm : maxShortCm

  const currentLongCm = Math.max(widthCm, heightCm)
  const unitName = unit === 'in' ? 'inches' : 'centimeters'
  /** A size as the labels write it: height first, in the field's unit. */
  const sizeText = (heightCm: number, widthCm: number) => formatDimensions(widthCm, heightCm, unit)

  const commitLongEdge = (longCm: number) => {
    const clampedLong = clampCm(longCm, effectiveMinLongCm, effectiveMaxLongCm, custom.stepCm)
    const shortCm = clampedLong * aspectShortOverLong
    const newWidth = isPortrait ? shortCm : clampedLong
    const newHeight = isPortrait ? clampedLong : shortCm
    setWidthInput(fieldText(newWidth, custom.stepCm))
    setHeightInput(fieldText(newHeight, custom.stepCm))
    onChange({ widthCm: newWidth, heightCm: newHeight })
  }

  const handleChange = (which: 'width' | 'height', raw: string) => {
    if (which === 'width') setWidthInput(raw)
    else setHeightInput(raw)
    // Read in the unit the field is written in, kept in cm (units.md).
    const parsed = parseLengthInput(raw, unit)
    if (parsed === null) return

    if (ratioWH === null) {
      const w = which === 'width' ? clampCm(parsed, minWidthCm, maxWidthCm, custom.stepCm) : widthCm
      const h =
        which === 'height' ? clampCm(parsed, minHeightCm, maxHeightCm, custom.stepCm) : heightCm
      onChange({ widthCm: w, heightCm: h })
      return
    }

    let w: number
    let h: number
    if (which === 'width') {
      w = clampCm(parsed, minWidthCm, maxWidthCm, custom.stepCm)
      h = clampCm(w / ratioWH, minHeightCm, maxHeightCm, custom.stepCm)
      setHeightInput(fieldText(h, custom.stepCm))
    } else {
      h = clampCm(parsed, minHeightCm, maxHeightCm, custom.stepCm)
      w = clampCm(h * ratioWH, minWidthCm, maxWidthCm, custom.stepCm)
      setWidthInput(fieldText(w, custom.stepCm))
    }
    onChange({ widthCm: w, heightCm: h })
  }

  return (
    <div className={styles.customSizeRow}>
      <label className={styles.customSizeField}>
        <span>Height ({unit})</span>
        <Input
          type="text"
          inputMode="decimal"
          value={heightInput}
          disabled={disabled}
          onFocus={() => setEditing('height')}
          onBlur={() => setEditing(null)}
          onChange={(e) => handleChange('height', e.target.value)}
          aria-label={`Custom print height in ${unitName}`}
        />
      </label>
      <span className={styles.customSizeSeparator} aria-hidden="true">
        ×
      </span>
      <label className={styles.customSizeField}>
        <span>Width ({unit})</span>
        <Input
          type="text"
          inputMode="decimal"
          value={widthInput}
          disabled={disabled}
          onFocus={() => setEditing('width')}
          onBlur={() => setEditing(null)}
          onChange={(e) => handleChange('width', e.target.value)}
          aria-label={`Custom print width in ${unitName}`}
        />
      </label>
      {showSlider && (
        <div className={styles.customSizeSlider}>
          <Slider
            touchRow
            min={effectiveMinLongCm}
            max={effectiveMaxLongCm}
            step={custom.stepCm}
            value={Math.min(effectiveMaxLongCm, Math.max(effectiveMinLongCm, currentLongCm))}
            disabled={disabled}
            onChange={(v) => commitLongEdge(v)}
            aria-label="Print size"
            aria-valuetext={sizeText(heightCm, widthCm)}
          />
          <div className={styles.customSizeRangeLabels}>
            <span>
              {sizeText(
                isPortrait ? effectiveMinLongCm : minShortCm,
                isPortrait ? minShortCm : effectiveMinLongCm,
              )}
            </span>
            <span>
              {sizeText(
                isPortrait ? effectiveMaxLongCm : maxShortCm,
                isPortrait ? maxShortCm : effectiveMaxLongCm,
              )}
            </span>
          </div>
        </div>
      )}
      {aspectLocked && (
        <p className={styles.customSizeHint}>
          {showSlider
            ? "Height and width are locked to this artwork's aspect ratio — change either, the other follows. This artwork can be printed at any size in the range above."
            : `Locked to the artwork's aspect ratio. Printable range for this file: ${sizeText(
                isPortrait ? effectiveMinLongCm : minShortCm,
                isPortrait ? minShortCm : effectiveMinLongCm,
              )} – ${sizeText(
                isPortrait ? effectiveMaxLongCm : maxShortCm,
                isPortrait ? maxShortCm : effectiveMaxLongCm,
              )}.`}
        </p>
      )}
    </div>
  )
}

/** An inch field's text: one decimal, from the stored cm (empty for 0, like `formatCm`). */
function formatInches(cm: number): string {
  if (!Number.isFinite(cm) || cm === 0) return ''
  return toUnit(cm, 'in').toFixed(1)
}

export function formatCm(value: number, step: number): string {
  if (!Number.isFinite(value) || value === 0) return ''
  const decimals = step >= 1 ? 0 : Math.ceil(-Math.log10(step))
  return value.toFixed(decimals)
}
