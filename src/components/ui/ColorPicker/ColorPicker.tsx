'use client'

import { useState, useEffect } from 'react'
import type { ChangeEvent } from 'react'

import styles from './ColorPicker.module.scss'

type ColorPickerProps = {
  textColor: string
  onColorSelect: (color: string) => void
  disabled?: boolean
}

const ColorPicker = ({ textColor = '#000000', onColorSelect, disabled }: ColorPickerProps) => {
  const [selectedColor, setSelectedColor] = useState(textColor)

  useEffect(() => {
    setSelectedColor(textColor)
  }, [textColor])

  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    const color = event.target.value
    setSelectedColor(color)
    onColorSelect(color)
  }

  return (
    <div
      className={styles.picker}
      style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
    >
      <input type="color" value={selectedColor} onChange={handleColorChange} disabled={disabled} />
      <span className={styles.label}>{selectedColor}</span>
    </div>
  )
}

export default ColorPicker
