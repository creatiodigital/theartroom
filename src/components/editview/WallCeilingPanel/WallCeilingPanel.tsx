'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Text } from '@/components/ui/Typography'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { hideWallCeilingPanel } from '@/redux/slices/dashboardSlice'
import { setExhibitionField } from '@/redux/slices/exhibitionSlice'
import type { TExhibition } from '@/types/exhibition'
import type { RootState } from '@/redux/store'

import styles from '../LightingPanel/LightingPanel.module.scss'

const DEFAULT_WALL_COLOR = '#ffffff'
const DEFAULT_CEILING_COLOR = '#ffffff'

const WallCeilingPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const set = (field: keyof TExhibition, value: TExhibition[keyof TExhibition]) => {
    dispatch(setExhibitionField({ field, value }))
    setSaved(false)
  }

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const wallColor = useSelector(
    (state: RootState) => state.exhibition.wallColor ?? DEFAULT_WALL_COLOR,
  )
  const ceilingColor = useSelector(
    (state: RootState) => state.exhibition.ceilingColor ?? DEFAULT_CEILING_COLOR,
  )
  const wallBrightness = useSelector((state: RootState) => state.exhibition.wallBrightness ?? 1.8)

  const handleSave = async () => {
    if (!exhibitionId) return

    setSaving(true)
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallColor,
          ceilingColor,
          wallBrightness,
        }),
      })

      if (response.ok) {
        setSaved(true)
      }
    } catch (error) {
      console.error('Failed to save wall & ceiling settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    dispatch(hideWallCeilingPanel())
  }

  return (
    <SettingsPanel title="Wall & Ceiling" onClose={handleClose}>
      {/* Wall Color Section */}
      <div className={styles.section}>
        <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
          Wall Color
        </Text>

        <div className={styles.field}>
          <label className={styles.label}>Color</label>
          <ColorPicker textColor={wallColor} onColorSelect={(color) => set('wallColor', color)} />
        </div>
      </div>

      {/* Ceiling Color Section */}
      <div className={styles.section}>
        <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
          Ceiling Color
        </Text>

        <div className={styles.field}>
          <label className={styles.label}>Color</label>
          <ColorPicker
            textColor={ceilingColor}
            onColorSelect={(color) => set('ceilingColor', color)}
          />
        </div>
      </div>

      {/* Temporary: Lambert Brightness Boost */}
      <div className={styles.section}>
        <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
          Wall Brightness
        </Text>
        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Brightness</label>
            <span className={styles.sliderValue}>{wallBrightness.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="5.0"
            step="0.05"
            value={wallBrightness}
            onChange={(e) => set('wallBrightness', parseFloat(e.target.value))}
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

export default WallCeilingPanel
