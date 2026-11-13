'use client'

import { useState, useEffect } from 'react'
import type { ChangeEvent } from 'react'

import styles from './ColorPicker.module.scss'

type ColorPickerProps = {
  textColor: string
  onColorSelect: (color: string) => void
  disabled?: boolean
} & (
  | { variant?: 'default'; name?: undefined; 'aria-label'?: undefined; emptyLabel?: undefined }
  | {
      /**
       * The 3D editor's color rows (editor3d.md): the whole row is the input's <label>, so a
       * click anywhere on it opens the same native picker. `row`: a 40px swatch, the name over
       * the hex, "Change" on the right (Walls, Windows). `inline`: the name on the left, a 24px
       * swatch and the hex on the right (inside a card, e.g. Lamp color). `field`: the wall
       * view's (wallview.md): the name above a 36px box with an 18px swatch and the hex.
       */
      variant: 'row' | 'inline' | 'field'
      /** The row's visible name; with the hex, the input's accessible name. */
      name: string
      /**
       * Only where the name needs its context to be told apart, and then containing it
       * (questions.md Q135), e.g. "Room 2 · Panel 1 color".
       */
      'aria-label'?: string
      /**
       * `field` only: there is no color (e.g. a text box's background is None). The swatch is
       * drawn crossed and this word replaces the hex; the picker still opens and sets a color.
       */
      emptyLabel?: string
    }
)

const ColorPicker = ({
  textColor = '#000000',
  onColorSelect,
  disabled,
  variant = 'default',
  name,
  'aria-label': ariaLabel,
  emptyLabel,
}: ColorPickerProps) => {
  const [selectedColor, setSelectedColor] = useState(textColor)

  useEffect(() => {
    setSelectedColor(textColor)
  }, [textColor])

  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    const color = event.target.value
    setSelectedColor(color)
    onColorSelect(color)
  }

  const disabledStyle = disabled ? { opacity: 0.5, pointerEvents: 'none' as const } : undefined

  if (variant === 'row') {
    return (
      <label className={styles.row} style={disabledStyle}>
        <input
          type="color"
          className={styles.rowSwatch}
          value={selectedColor}
          onChange={handleColorChange}
          disabled={disabled}
          aria-label={ariaLabel}
        />
        <span className={styles.rowText}>
          <span className={styles.rowName}>{name}</span>
          <span className={styles.hex}>{selectedColor}</span>
        </span>
        <span className={styles.rowAction} aria-hidden>
          Change
        </span>
      </label>
    )
  }

  if (variant === 'inline') {
    return (
      <label className={styles.inline} style={disabledStyle}>
        <span className={styles.inlineName}>{name}</span>
        <span className={styles.inlineValue}>
          <input
            type="color"
            className={styles.inlineSwatch}
            value={selectedColor}
            onChange={handleColorChange}
            disabled={disabled}
            aria-label={ariaLabel}
          />
          <span className={styles.hex}>{selectedColor}</span>
        </span>
      </label>
    )
  }

  if (variant === 'field') {
    return (
      <label className={styles.field} style={disabledStyle}>
        <span className={styles.fieldName}>{name}</span>
        <span className={styles.fieldBox}>
          <span className={styles.fieldSwatchWrap}>
            <input
              type="color"
              className={styles.fieldSwatch}
              value={selectedColor}
              onChange={handleColorChange}
              disabled={disabled}
              aria-label={ariaLabel}
            />
            {emptyLabel && <span aria-hidden className={styles.fieldEmptySwatch} />}
          </span>
          <span className={emptyLabel ? styles.fieldEmpty : styles.fieldHex}>
            {emptyLabel ?? selectedColor}
          </span>
        </span>
      </label>
    )
  }

  return (
    <div className={styles.picker} style={disabledStyle}>
      <input type="color" value={selectedColor} onChange={handleColorChange} disabled={disabled} />
      <span className={styles.label}>{selectedColor}</span>
    </div>
  )
}

export default ColorPicker
