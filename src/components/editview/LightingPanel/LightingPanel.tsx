'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { hideLightingPanel } from '@/redux/slices/dashboardSlice'
import {
  setAmbientLightColor,
  setAmbientLightIntensity,
  setSkylightColor,
  setSkylightIntensity,
  setCeilingLampColor,
  setCeilingLampIntensity,
} from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

import styles from './LightingPanel.module.scss'

// Default values
const DEFAULT_AMBIENT_COLOR = '#e4e8f2'
const DEFAULT_AMBIENT_INTENSITY = 1.0
const DEFAULT_SKYLIGHT_COLOR = '#ffffff'
const DEFAULT_SKYLIGHT_INTENSITY = 4.0
const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_LAMP_INTENSITY = 4.0

// Spaces that have specific light types
const SPACES_WITH_SKYLIGHT = ['modern']
const SPACES_WITH_LAMPS = ['modern']

const LightingPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) || 'classic'
  
  const ambientColor = useSelector(
    (state: RootState) => state.exhibition.ambientLightColor ?? DEFAULT_AMBIENT_COLOR,
  )
  const ambientIntensity = useSelector(
    (state: RootState) => state.exhibition.ambientLightIntensity ?? DEFAULT_AMBIENT_INTENSITY,
  )
  const skylightColor = useSelector(
    (state: RootState) => state.exhibition.skylightColor ?? DEFAULT_SKYLIGHT_COLOR,
  )
  const skylightIntensity = useSelector(
    (state: RootState) => state.exhibition.skylightIntensity ?? DEFAULT_SKYLIGHT_INTENSITY,
  )
  const lampColor = useSelector(
    (state: RootState) => state.exhibition.ceilingLampColor ?? DEFAULT_LAMP_COLOR,
  )
  const lampIntensity = useSelector(
    (state: RootState) => state.exhibition.ceilingLampIntensity ?? DEFAULT_LAMP_INTENSITY,
  )

  const hasSkylight = SPACES_WITH_SKYLIGHT.includes(spaceId)
  const hasLamps = SPACES_WITH_LAMPS.includes(spaceId)

  // Ambient light handlers
  const handleAmbientColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setAmbientLightColor(e.target.value))
    setSaved(false)
  }

  const handleAmbientIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setAmbientLightIntensity(parseFloat(e.target.value)))
    setSaved(false)
  }

  // Skylight handlers
  const handleSkylightColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSkylightColor(e.target.value))
    setSaved(false)
  }

  const handleSkylightIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSkylightIntensity(parseFloat(e.target.value)))
    setSaved(false)
  }

  // Ceiling lamp handlers
  const handleLampColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setCeilingLampColor(e.target.value))
    setSaved(false)
  }

  const handleLampIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setCeilingLampIntensity(parseFloat(e.target.value)))
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
          // Note: other light settings not saved to DB yet
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
    <SettingsPanel title="Lighting" onClose={handleClose}>
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
              onChange={handleAmbientColorChange}
              className={styles.colorPicker}
            />
            <input
              type="text"
              value={ambientColor}
              onChange={handleAmbientColorChange}
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
            onChange={handleAmbientIntensityChange}
            className={styles.slider}
          />
        </div>
      </div>

      {/* Ceiling Light Section - only for spaces with skylight */}
      {hasSkylight && (
        <div className={styles.section}>
          <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
            Ceiling Light
          </Text>
          
          <div className={styles.field}>
            <label className={styles.label}>Color</label>
            <div className={styles.colorRow}>
              <input
                type="color"
                value={skylightColor}
                onChange={handleSkylightColorChange}
                className={styles.colorPicker}
              />
              <input
                type="text"
                value={skylightColor}
                onChange={handleSkylightColorChange}
                className={styles.colorInput}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.sliderHeader}>
              <label className={styles.label}>Intensity</label>
              <span className={styles.sliderValue}>{skylightIntensity.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={skylightIntensity}
              onChange={handleSkylightIntensityChange}
              className={styles.slider}
            />
          </div>
        </div>
      )}

      {/* Ceiling Lamps Section - only for spaces with lamps */}
      {hasLamps && (
        <div className={styles.section}>
          <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
            Ceiling Lamps
          </Text>
          
          <div className={styles.field}>
            <label className={styles.label}>Color</label>
            <div className={styles.colorRow}>
              <input
                type="color"
                value={lampColor}
                onChange={handleLampColorChange}
                className={styles.colorPicker}
              />
              <input
                type="text"
                value={lampColor}
                onChange={handleLampColorChange}
                className={styles.colorInput}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.sliderHeader}>
              <label className={styles.label}>Intensity</label>
              <span className={styles.sliderValue}>{lampIntensity.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={lampIntensity}
              onChange={handleLampIntensityChange}
              className={styles.slider}
            />
          </div>
        </div>
      )}

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

export default LightingPanel



