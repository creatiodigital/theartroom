'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { hideFurniturePanel } from '@/redux/slices/dashboardSlice'
import {
  setBenchVisible,
  setBenchPositionX,
  setBenchPositionZ,
  setBenchRotationY,
} from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

import styles from '../HumanPanel/HumanPanel.module.scss'

const FurniturePanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const isBenchVisible = useSelector((state: RootState) => state.exhibition.benchVisible ?? false)
  const benchPositionX = useSelector((state: RootState) => state.exhibition.benchPositionX ?? 0)
  const benchPositionZ = useSelector((state: RootState) => state.exhibition.benchPositionZ ?? 0)
  const benchRotationY = useSelector((state: RootState) => state.exhibition.benchRotationY ?? 0)

  const handleClose = () => {
    dispatch(hideFurniturePanel())
  }

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setBenchVisible(e.target.checked))
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
          benchVisible: isBenchVisible,
          benchPositionX,
          benchPositionZ,
          benchRotationY,
        }),
      })

      if (response.ok) {
        setSaved(true)
      }
    } catch (error) {
      console.error('Failed to save furniture settings:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsPanel title="Furniture" onClose={handleClose}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Small Bench</span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={isBenchVisible} onChange={handleToggle} />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>X Position</label>
            <span className={styles.sliderValue}>{benchPositionX.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.1"
            value={benchPositionX}
            onChange={(e) => {
              dispatch(setBenchPositionX(parseFloat(e.target.value)))
              setSaved(false)
            }}
            className={styles.slider}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Z Position</label>
            <span className={styles.sliderValue}>{benchPositionZ.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.1"
            value={benchPositionZ}
            onChange={(e) => {
              dispatch(setBenchPositionZ(parseFloat(e.target.value)))
              setSaved(false)
            }}
            className={styles.slider}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Rotation</label>
            <span className={styles.sliderValue}>{benchRotationY.toFixed(0)}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={benchRotationY}
            onChange={(e) => {
              dispatch(setBenchRotationY(parseFloat(e.target.value)))
              setSaved(false)
            }}
            className={styles.slider}
          />
        </div>
      </div>

      {/* Actions */}
      <div className={styles.section}>
        <Button
          variant="primary"
          label={saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          onClick={handleSave}
          disabled={saving}
          fullWidth
        />
      </div>
    </SettingsPanel>
  )
}

export default FurniturePanel
