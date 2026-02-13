'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { hideFloorPanel } from '@/redux/slices/dashboardSlice'
import {
  setFloorReflectiveness,
  setFloorMaterial,
  setFloorTextureScale,
  setFloorTextureOffsetX,
  setFloorTextureOffsetY,
  setFloorTemperature,
  setFloorNormalScale,
  setFloorRotation,
} from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

import styles from './FloorPanel.module.scss'

const DEFAULT_FLOOR_REFLECTIVENESS = 0.3
const DEFAULT_FLOOR_TEXTURE_SCALE = 2.0

const FLOOR_MATERIALS = [
  { value: 'concrete', label: 'Concrete' },
  { value: 'wood', label: 'Wood' },
  { value: 'marble', label: 'Marble' },
  { value: 'chevron', label: 'Chevron' },
  { value: 'parquet', label: 'Parquet' },
] as const

const FloorPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)

  const floorReflectiveness = useSelector(
    (state: RootState) => state.exhibition.floorReflectiveness ?? DEFAULT_FLOOR_REFLECTIVENESS,
  )

  const floorMaterial = useSelector(
    (state: RootState) => state.exhibition.floorMaterial ?? 'concrete',
  )

  // Clamp to valid range 0.5-5.0 in case of legacy values
  const rawFloorTextureScale = useSelector(
    (state: RootState) => state.exhibition.floorTextureScale ?? DEFAULT_FLOOR_TEXTURE_SCALE,
  )
  const floorTextureScale = Math.max(0.5, Math.min(5.0, rawFloorTextureScale))

  const floorTextureOffsetX = useSelector(
    (state: RootState) => state.exhibition.floorTextureOffsetX ?? 0,
  )

  const floorTextureOffsetY = useSelector(
    (state: RootState) => state.exhibition.floorTextureOffsetY ?? 0,
  )

  const floorTemperature = useSelector((state: RootState) => state.exhibition.floorTemperature ?? 0)

  const floorNormalScale = useSelector(
    (state: RootState) => state.exhibition.floorNormalScale ?? 1.0,
  )

  const floorRotation = useSelector((state: RootState) => state.exhibition.floorRotation ?? 0)

  const handleMaterialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(
      setFloorMaterial(e.target.value as 'concrete' | 'wood' | 'marble' | 'chevron' | 'parquet'),
    )
    setSaved(false)
  }

  const handleTextureScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Invert: slider right = bigger tiles (lower repeat value internally)
    const invertedValue = 5.5 - parseFloat(e.target.value)
    dispatch(setFloorTextureScale(invertedValue))
    setSaved(false)
  }

  const handleOffsetXChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setFloorTextureOffsetX(parseFloat(e.target.value)))
    setSaved(false)
  }

  const handleOffsetYChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setFloorTextureOffsetY(parseFloat(e.target.value)))
    setSaved(false)
  }

  const handleReflectivenessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setFloorReflectiveness(parseFloat(e.target.value)))
    setSaved(false)
  }

  const handleTemperatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setFloorTemperature(parseFloat(e.target.value)))
    setSaved(false)
  }

  const handleNormalScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setFloorNormalScale(parseFloat(e.target.value)))
    setSaved(false)
  }

  const handleRotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setFloorRotation(parseFloat(e.target.value)))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!exhibitionId) return

    setSaving(true)
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          floorMaterial,
          floorTextureScale,
          floorTextureOffsetX,
          floorTextureOffsetY,
          floorRotation,
          floorTemperature,
          floorNormalScale,
          floorReflectiveness,
        }),
      })

      if (response.ok) {
        setSaved(true)
      }
    } catch (error) {
      console.error('Failed to save floor settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    dispatch(hideFloorPanel())
  }

  return (
    <SettingsPanel title="Floor" onClose={handleClose}>
      <div className={styles.section}>
        <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
          Material
        </Text>
        <div className={styles.field}>
          <label className={styles.label}>Type</label>
          <select value={floorMaterial} onChange={handleMaterialChange} className={styles.select}>
            {FLOOR_MATERIALS.map((material) => (
              <option key={material.value} value={material.value}>
                {material.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Tile Scale</label>
            <span className={styles.sliderValue}>{(5.5 - floorTextureScale).toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.01"
            value={5.5 - floorTextureScale}
            onChange={handleTextureScaleChange}
            className={styles.slider}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Tile Position X</label>
            <span className={styles.sliderValue}>{floorTextureOffsetX.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={floorTextureOffsetX}
            onChange={handleOffsetXChange}
            className={styles.slider}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Tile Position Y</label>
            <span className={styles.sliderValue}>{floorTextureOffsetY.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={floorTextureOffsetY}
            onChange={handleOffsetYChange}
            className={styles.slider}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Floor Rotation</label>
            <span className={styles.sliderValue}>{floorRotation.toFixed(0)}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={floorRotation}
            onChange={handleRotationChange}
            className={styles.slider}
          />
        </div>
      </div>

      <div className={styles.section}>
        <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
          Surface
        </Text>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Reflectiveness</label>
            <span className={styles.sliderValue}>{floorReflectiveness.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={floorReflectiveness}
            onChange={handleReflectivenessChange}
            className={styles.slider}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Floor Details</label>
            <span className={styles.sliderValue}>{floorNormalScale.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={floorNormalScale}
            onChange={handleNormalScaleChange}
            className={styles.slider}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Color Temperature</label>
            <span className={styles.sliderValue}>{floorTemperature.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.05"
            value={floorTemperature}
            onChange={handleTemperatureChange}
            className={styles.slider}
          />
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <Button
          variant="primary"
          label={saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          onClick={handleSave}
          disabled={saving}
          className={styles.saveButton}
        />
      </div>
    </SettingsPanel>
  )
}

export default FloorPanel
