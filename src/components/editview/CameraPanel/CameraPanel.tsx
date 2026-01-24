'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { hideCameraPanel } from '@/redux/slices/dashboardSlice'
import { setCameraFOV, setCameraElevation } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

import styles from './CameraPanel.module.scss'

const DEFAULT_CAMERA_FOV = 50
const DEFAULT_CAMERA_ELEVATION = 1.6

const CameraPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)

  const cameraFOV = useSelector(
    (state: RootState) => state.exhibition.cameraFOV ?? DEFAULT_CAMERA_FOV,
  )

  const cameraElevation = useSelector(
    (state: RootState) => state.exhibition.cameraElevation ?? DEFAULT_CAMERA_ELEVATION,
  )

  const handleFOVChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setCameraFOV(parseFloat(e.target.value)))
    setSaved(false)
  }

  const handleElevationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setCameraElevation(parseFloat(e.target.value)))
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
          cameraFOV,
          cameraElevation,
        }),
      })

      if (response.ok) {
        setSaved(true)
      }
    } catch (error) {
      console.error('Failed to save camera settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    dispatch(hideCameraPanel())
  }

  return (
    <SettingsPanel title="Camera" onClose={handleClose}>
      <div className={styles.section}>
        <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
          View
        </Text>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Field of View</label>
            <span className={styles.sliderValue}>{cameraFOV.toFixed(0)}°</span>
          </div>
          <input
            type="range"
            min="40"
            max="60"
            step="1"
            value={cameraFOV}
            onChange={handleFOVChange}
            className={styles.slider}
          />
          <div className={styles.sliderLabels}>
            <span>Narrow</span>
            <span>Wide</span>
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Eye Level</label>
            <span className={styles.sliderValue}>{cameraElevation.toFixed(2)}m</span>
          </div>
          <input
            type="range"
            min="1.5"
            max="1.7"
            step="0.01"
            value={cameraElevation}
            onChange={handleElevationChange}
            className={styles.slider}
          />
          <div className={styles.sliderLabels}>
            <span>Lower</span>
            <span>Higher</span>
          </div>
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

export default CameraPanel
