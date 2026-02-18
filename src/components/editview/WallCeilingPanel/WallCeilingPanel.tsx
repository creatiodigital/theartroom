'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Text } from '@/components/ui/Typography'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { hideWallCeilingPanel } from '@/redux/slices/dashboardSlice'
import { setWallColor, setCeilingColor } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

import styles from '../LightingPanel/LightingPanel.module.scss'

const DEFAULT_WALL_COLOR = '#ffffff'
const DEFAULT_CEILING_COLOR = '#ffffff'

const WallCeilingPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const wallColor = useSelector(
    (state: RootState) => state.exhibition.wallColor ?? DEFAULT_WALL_COLOR,
  )
  const ceilingColor = useSelector(
    (state: RootState) => state.exhibition.ceilingColor ?? DEFAULT_CEILING_COLOR,
  )

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
          <ColorPicker
            textColor={wallColor}
            onColorSelect={(color) => {
              dispatch(setWallColor(color))
              setSaved(false)
            }}
          />
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
            onColorSelect={(color) => {
              dispatch(setCeilingColor(color))
              setSaved(false)
            }}
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
