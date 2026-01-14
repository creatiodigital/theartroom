'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { hideLightingPanel } from '@/redux/slices/dashboardSlice'
import { setAmbientLightColor, setAmbientLightIntensity } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

import styles from './LightingPanel.module.scss'

// Default values matching the hardcoded values in AmbientLight components
const DEFAULT_COLOR = '#e4e8f2'
const DEFAULT_INTENSITY = 1.0

const LightingPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const ambientColor = useSelector(
    (state: RootState) => state.exhibition.ambientLightColor ?? DEFAULT_COLOR,
  )
  const ambientIntensity = useSelector(
    (state: RootState) => state.exhibition.ambientLightIntensity ?? DEFAULT_INTENSITY,
  )

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setAmbientLightColor(e.target.value))
    setSaved(false)
  }

  const handleIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setAmbientLightIntensity(parseFloat(e.target.value)))
    setSaved(false)
  }

  const handleReset = () => {
    dispatch(setAmbientLightColor(DEFAULT_COLOR))
    dispatch(setAmbientLightIntensity(DEFAULT_INTENSITY))
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
          ambientLightColor: ambientColor,
          ambientLightIntensity: ambientIntensity,
        }),
      })

      if (response.ok) {
        setSaved(true)
      }
    } catch (error) {
      console.error('Failed to save lighting settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    dispatch(hideLightingPanel())
  }

  return (
    <SettingsPanel title="Lighting">
      {/* Ambient Light Section */}
      <div className={styles.section}>
        <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
          Ambient Light
        </Text>
        
        <div className={styles.field}>
          <label className={styles.label}>Color</label>
          <div className={styles.colorRow}>
            <input
              type="color"
              value={ambientColor}
              onChange={handleColorChange}
              className={styles.colorPicker}
            />
            <input
              type="text"
              value={ambientColor}
              onChange={handleColorChange}
              className={styles.colorInput}
            />
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Intensity</label>
            <span className={styles.sliderValue}>{ambientIntensity.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={ambientIntensity}
            onChange={handleIntensityChange}
            className={styles.slider}
          />
          <Button
            variant="secondary"
            size="regular"
            label="Reset to Default"
            onClick={handleReset}
            className={styles.resetButton}
          />
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <Button
          variant="secondary"
          label="Close"
          onClick={handleClose}
          className={styles.closeButton}
        />
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

export default LightingPanel
