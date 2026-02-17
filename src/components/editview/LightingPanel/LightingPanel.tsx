'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Text } from '@/components/ui/Typography'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { getSpaceFeatures } from '@/config/spaceConfig'
import { hideLightingPanel } from '@/redux/slices/dashboardSlice'
import {
  setAmbientLightColor,
  setAmbientLightIntensity,
  setSkylightColor,
  setSkylightIntensity,
  setCeilingLampColor,
  setCeilingLampIntensity,
  setTrackLampColor,
  setTrackLampIntensity,
  setTrackLampAngle,
  setTrackLampDistance,
  setRecessedLampColor,
  setRecessedLampIntensity,
  setTrackLampMaterialColor,
  setWindowLightColor,
  setWindowLightIntensity,
  setWindowTransparency,
  setHdriEnvironment,
  setHdriRotation,
  setCeilingLightMode,
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
const DEFAULT_TRACK_LAMP_COLOR = '#ffffff'
const DEFAULT_TRACK_LAMP_INTENSITY = 4.0
const DEFAULT_RECESSED_LAMP_COLOR = '#ffffff'
const DEFAULT_RECESSED_LAMP_INTENSITY = 4.0
const DEFAULT_TRACK_LAMP_MATERIAL_COLOR = '#ffffff'
const DEFAULT_TRACK_LAMP_ANGLE = 0.45
const DEFAULT_TRACK_LAMP_DISTANCE = 5.0
const DEFAULT_WINDOW_COLOR = '#ffffff'
const DEFAULT_WINDOW_INTENSITY = 4.0
const DEFAULT_HDRI_ROTATION = 128

const HDRI_OPTIONS = [{ value: 'soil', label: 'Soil' }] as const

const CEILING_LIGHT_OPTIONS = [
  { value: 'track', label: 'Track Lamps' },
  { value: 'plafond', label: 'Plafond Lamps' },
  { value: 'track-plafond', label: 'Track Lamps + Plafond Lamps' },
] as const

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
  const trackLampColor = useSelector(
    (state: RootState) => state.exhibition.trackLampColor ?? DEFAULT_TRACK_LAMP_COLOR,
  )
  const trackLampIntensity = useSelector(
    (state: RootState) => state.exhibition.trackLampIntensity ?? DEFAULT_TRACK_LAMP_INTENSITY,
  )
  const recessedLampColor = useSelector(
    (state: RootState) => state.exhibition.recessedLampColor ?? DEFAULT_RECESSED_LAMP_COLOR,
  )
  const recessedLampIntensity = useSelector(
    (state: RootState) => state.exhibition.recessedLampIntensity ?? DEFAULT_RECESSED_LAMP_INTENSITY,
  )
  const trackLampMaterialColor = useSelector(
    (state: RootState) =>
      state.exhibition.trackLampMaterialColor ?? DEFAULT_TRACK_LAMP_MATERIAL_COLOR,
  )
  const trackLampAngle = useSelector(
    (state: RootState) => state.exhibition.trackLampAngle ?? DEFAULT_TRACK_LAMP_ANGLE,
  )
  const trackLampDistance = useSelector(
    (state: RootState) => state.exhibition.trackLampDistance ?? DEFAULT_TRACK_LAMP_DISTANCE,
  )
  const ceilingLightMode = useSelector(
    (state: RootState) => state.exhibition.ceilingLightMode ?? 'track-plafond',
  )
  const windowColor = useSelector(
    (state: RootState) => state.exhibition.windowLightColor ?? DEFAULT_WINDOW_COLOR,
  )
  const windowIntensity = useSelector(
    (state: RootState) => state.exhibition.windowLightIntensity ?? DEFAULT_WINDOW_INTENSITY,
  )
  const windowTransparency = useSelector(
    (state: RootState) => state.exhibition.windowTransparency ?? false,
  )
  const hdriEnvironment = useSelector(
    (state: RootState) => state.exhibition.hdriEnvironment ?? 'soil',
  )
  const hdriRotation = useSelector(
    (state: RootState) => state.exhibition.hdriRotation ?? DEFAULT_HDRI_ROTATION,
  )

  // Get features from space config
  const spaceFeatures = getSpaceFeatures(spaceId)
  const hasSkylight = spaceFeatures.hasSkylight
  const hasLamps = spaceFeatures.hasLamps
  const hasTrackLamps = spaceFeatures.hasTrackLamps
  const hasRecessedLamps = spaceFeatures.hasRecessedLamps
  const hasWindows = spaceFeatures.hasWindows

  // Ambient light handlers
  const handleAmbientIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setAmbientLightIntensity(parseFloat(e.target.value)))
    setSaved(false)
  }

  // Skylight handlers
  const handleSkylightIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSkylightIntensity(parseFloat(e.target.value)))
    setSaved(false)
  }

  // Ceiling lamp handlers
  const handleLampIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setCeilingLampIntensity(parseFloat(e.target.value)))
    setSaved(false)
  }

  // Track lamp handlers
  const handleTrackLampIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setTrackLampIntensity(parseFloat(e.target.value)))
    setSaved(false)
  }

  const handleTrackLampAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setTrackLampAngle(parseFloat(e.target.value)))
    setSaved(false)
  }

  const handleTrackLampDistanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setTrackLampDistance(parseFloat(e.target.value)))
    setSaved(false)
  }

  // Recessed lamp handlers
  const handleRecessedLampIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setRecessedLampIntensity(parseFloat(e.target.value)))
    setSaved(false)
  }

  // Window light handlers
  const handleWindowIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setWindowLightIntensity(parseFloat(e.target.value)))
    setSaved(false)
  }

  const handleWindowTransparencyChange = () => {
    dispatch(setWindowTransparency(!windowTransparency))
    setSaved(false)
  }

  const handleHdriChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setHdriEnvironment(e.target.value))
    setSaved(false)
  }

  const handleHdriRotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setHdriRotation(parseFloat(e.target.value)))
    setSaved(false)
  }

  const handleCeilingLightModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setCeilingLightMode(e.target.value))
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
          skylightColor,
          skylightIntensity,
          ceilingLampColor: lampColor,
          ceilingLampIntensity: lampIntensity,
          trackLampColor,
          trackLampIntensity,
          trackLampAngle,
          trackLampDistance,
          recessedLampColor,
          recessedLampIntensity,
          trackLampMaterialColor,
          windowLightColor: windowColor,
          windowLightIntensity: windowIntensity,
          windowTransparency,
          hdriEnvironment,
          hdriRotation,
          ceilingLightMode,
          // Note: floorReflectiveness is in FloorPanel
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
      {/* HDRI Environment Section */}
      <div className={styles.section}>
        <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
          Sky Light
        </Text>
        <div className={styles.field}>
          <label className={styles.label}>Type</label>
          <select value={hdriEnvironment} onChange={handleHdriChange} className={styles.select}>
            {HDRI_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Rotation</label>
            <span className={styles.sliderValue}>{hdriRotation.toFixed(0)}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={hdriRotation}
            onChange={handleHdriRotationChange}
            className={styles.slider}
          />
        </div>
      </div>

      {/* Ambient Light Section */}
      <div className={styles.section}>
        <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
          Ambient Light
        </Text>

        <div className={styles.field}>
          <label className={styles.label}>Color</label>
          <ColorPicker
            textColor={ambientColor}
            onColorSelect={(color) => {
              dispatch(setAmbientLightColor(color))
              setSaved(false)
            }}
          />
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
            <ColorPicker
              textColor={skylightColor}
              onColorSelect={(color) => {
                dispatch(setSkylightColor(color))
                setSaved(false)
              }}
            />
          </div>

          <div className={styles.field}>
            <div className={styles.sliderHeader}>
              <label className={styles.label}>Intensity</label>
              <span className={styles.sliderValue}>{skylightIntensity.toFixed(2)}</span>
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
            <ColorPicker
              textColor={lampColor}
              onColorSelect={(color) => {
                dispatch(setCeilingLampColor(color))
                setSaved(false)
              }}
            />
          </div>

          <div className={styles.field}>
            <div className={styles.sliderHeader}>
              <label className={styles.label}>Intensity</label>
              <span className={styles.sliderValue}>{lampIntensity.toFixed(2)}</span>
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

      {/* Ceiling Light Mode Section - only for spaces with track lamps */}
      {hasTrackLamps && (
        <div className={styles.section}>
          <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
            Ceiling Lights
          </Text>
          <div className={styles.field}>
            <label className={styles.label}>Type</label>
            <select
              value={ceilingLightMode}
              onChange={handleCeilingLightModeChange}
              className={styles.select}
            >
              {CEILING_LIGHT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Track Lamps Section - only when track lamps are visible */}
      {hasTrackLamps && (ceilingLightMode === 'track' || ceilingLightMode === 'track-plafond') && (
        <div className={styles.section}>
          <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
            Track Lamps
          </Text>

          <div className={styles.field}>
            <label className={styles.label}>Color</label>
            <ColorPicker
              textColor={trackLampColor}
              onColorSelect={(color) => {
                dispatch(setTrackLampColor(color))
                setSaved(false)
              }}
            />
          </div>

          <div className={styles.field}>
            <div className={styles.sliderHeader}>
              <label className={styles.label}>Intensity</label>
              <span className={styles.sliderValue}>{trackLampIntensity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={trackLampIntensity}
              onChange={handleTrackLampIntensityChange}
              className={styles.slider}
            />
          </div>

          <div className={styles.field}>
            <div className={styles.sliderHeader}>
              <label className={styles.label}>Angle</label>
              <span className={styles.sliderValue}>{(trackLampAngle * (180 / Math.PI)).toFixed(0)}°</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.2"
              step="0.05"
              value={trackLampAngle}
              onChange={handleTrackLampAngleChange}
              className={styles.slider}
            />
          </div>

          <div className={styles.field}>
            <div className={styles.sliderHeader}>
              <label className={styles.label}>Distance</label>
              <span className={styles.sliderValue}>{trackLampDistance.toFixed(1)}m</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={trackLampDistance}
              onChange={handleTrackLampDistanceChange}
              className={styles.slider}
            />
          </div>
        </div>
      )}

      {/* Track Lamp Material Section - only when track lamps are visible */}
      {hasTrackLamps && (ceilingLightMode === 'track' || ceilingLightMode === 'track-plafond') && (
        <div className={styles.section}>
          <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
            Track Lamp Material
          </Text>

          <div className={styles.field}>
            <label className={styles.label}>Color</label>
            <ColorPicker
              textColor={trackLampMaterialColor}
              onColorSelect={(color) => {
                dispatch(setTrackLampMaterialColor(color))
                setSaved(false)
              }}
            />
          </div>
        </div>
      )}

      {/* Recessed / Plafond Lamps Section - only when plafond lamps are visible */}
      {hasRecessedLamps &&
        (ceilingLightMode === 'plafond' || ceilingLightMode === 'track-plafond') && (
          <div className={styles.section}>
            <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
              Plafond Lamps
            </Text>

            <div className={styles.field}>
              <label className={styles.label}>Color</label>
              <ColorPicker
                textColor={recessedLampColor}
                onColorSelect={(color) => {
                  dispatch(setRecessedLampColor(color))
                  setSaved(false)
                }}
              />
            </div>

            <div className={styles.field}>
              <div className={styles.sliderHeader}>
                <label className={styles.label}>Intensity</label>
                <span className={styles.sliderValue}>{recessedLampIntensity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={recessedLampIntensity}
                onChange={handleRecessedLampIntensityChange}
                className={styles.slider}
              />
            </div>
          </div>
        )}

      {/* Window Light Section - only for spaces with windows */}
      {hasWindows && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
              Transparent Window
            </Text>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={windowTransparency}
                onChange={handleWindowTransparencyChange}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {windowTransparency ? (
            <div className={styles.field}>
              <label className={styles.label}>Window is transparent — HDRI visible</label>
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Color</label>
                <ColorPicker
                  textColor={windowColor}
                  onColorSelect={(color) => {
                    dispatch(setWindowLightColor(color))
                    setSaved(false)
                  }}
                />
              </div>

              <div className={styles.field}>
                <div className={styles.sliderHeader}>
                  <label className={styles.label}>Intensity</label>
                  <span className={styles.sliderValue}>{windowIntensity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={windowIntensity}
                  onChange={handleWindowIntensityChange}
                  className={styles.slider}
                />
              </div>
            </>
          )}
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
