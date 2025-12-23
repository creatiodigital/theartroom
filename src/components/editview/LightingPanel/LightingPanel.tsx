'use client'

import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { hideLightingPanel } from '@/redux/slices/dashboardSlice'
import { setAmbientLightColor, setAmbientLightIntensity } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

import styles from './LightingPanel.module.scss'

// Default values matching the hardcoded values in AmbientLight components
const DEFAULT_COLOR = '#e4e8f2'
const DEFAULT_INTENSITY = 0.2

const LightingPanel = () => {
  const dispatch = useDispatch()

  const ambientColor = useSelector(
    (state: RootState) => state.exhibition.ambientLightColor ?? DEFAULT_COLOR
  )
  const ambientIntensity = useSelector(
    (state: RootState) => state.exhibition.ambientLightIntensity ?? DEFAULT_INTENSITY
  )

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setAmbientLightColor(e.target.value))
  }

  const handleIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setAmbientLightIntensity(parseFloat(e.target.value)))
  }

  const handleReset = () => {
    dispatch(setAmbientLightColor(DEFAULT_COLOR))
    dispatch(setAmbientLightIntensity(DEFAULT_INTENSITY))
  }

  const handleClose = () => {
    dispatch(hideLightingPanel())
  }

  return (
    <SettingsPanel title="Lighting" onClose={handleClose}>
      {/* Ambient Light Color */}
      <div className={styles.section}>
        <label className={styles.label}>Ambient Light Color</label>
        <div className={styles.colorRow}>
          <input
            type="color"
            value={ambientColor}
            onChange={handleColorChange}
            className={styles.colorPicker}
          />
          <span className={styles.colorValue}>{ambientColor}</span>
        </div>
      </div>

      {/* Ambient Light Intensity */}
      <div className={styles.section}>
        <label className={styles.label}>
          Intensity: {ambientIntensity.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={ambientIntensity}
          onChange={handleIntensityChange}
          className={styles.slider}
        />
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <Button variant="small" label="Reset to Default" onClick={handleReset} />
      </div>
    </SettingsPanel>
  )
}

export default LightingPanel
