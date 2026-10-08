'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Text } from '@/components/ui/Typography'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { DEFAULT_RADIATOR_COLOR } from '@/components/scene/spaces/objects/Radiator'
import { DEFAULT_WINDOW_FRAME_COLOR } from '@/components/scene/spaces/objects/Windows'
import { hideWindowsPanel } from '@/redux/slices/dashboardSlice'
import { setExhibitionField } from '@/redux/slices/exhibitionSlice'
import type { TExhibition } from '@/types/exhibition'
import type { RootState } from '@/redux/store'

import styles from '../LightingPanel/LightingPanel.module.scss'

const WindowsPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const set = (field: keyof TExhibition, value: TExhibition[keyof TExhibition]) => {
    dispatch(setExhibitionField({ field, value }))
    setSaved(false)
  }

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const windowFrameColor = useSelector(
    (state: RootState) => state.exhibition.windowFrameColor ?? DEFAULT_WINDOW_FRAME_COLOR,
  )
  const radiatorColor = useSelector(
    (state: RootState) => state.exhibition.radiatorColor ?? DEFAULT_RADIATOR_COLOR,
  )

  const handleSave = async () => {
    if (!exhibitionId) return

    setSaving(true)
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windowFrameColor, radiatorColor }),
      })

      if (response.ok) {
        setSaved(true)
      }
    } catch (error) {
      console.error('Failed to save window settings:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsPanel title="Windows" onClose={() => dispatch(hideWindowsPanel())}>
      {/* One color for every window frame in the space */}
      <div className={styles.section}>
        <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
          Window Color
        </Text>

        <div className={styles.field}>
          <label className={styles.label}>Color</label>
          <ColorPicker
            textColor={windowFrameColor}
            onColorSelect={(color) => set('windowFrameColor', color)}
          />
        </div>
      </div>

      {/* Radiators — they sit under the windows */}
      <div className={styles.section}>
        <Text as="h3" size="sm" weight="medium" className={styles.sectionTitle}>
          Radiator Color
        </Text>

        <div className={styles.field}>
          <label className={styles.label}>Color</label>
          <ColorPicker
            textColor={radiatorColor}
            onColorSelect={(color) => set('radiatorColor', color)}
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

export default WindowsPanel
