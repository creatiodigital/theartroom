'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { GridFour } from '@phosphor-icons/react'

import { ColorPicker } from '@/components/ui/ColorPicker'
import { ToolPanel, useSaveTracking, useSavedMoment } from '@/components/editorChrome'
import { DEFAULT_RADIATOR_COLOR } from '@/components/scene/spaces/objects/Radiator'
import { DEFAULT_WINDOW_FRAME_COLOR } from '@/components/scene/spaces/objects/Windows'
import { hideWindowsPanel } from '@/redux/slices/dashboardSlice'
import { setExhibitionField } from '@/redux/slices/exhibitionSlice'
import type { TExhibition } from '@/types/exhibition'
import type { RootState } from '@/redux/store'

const WindowsPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useSavedMoment()

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  // Display only (questions.md Q131, Q139 b): the Save area's "Unsaved changes" / "Not saved".
  const saveTrack = useSaveTracking(exhibitionId ? `${exhibitionId}:windows` : null)

  const set = (field: keyof TExhibition, value: TExhibition[keyof TExhibition]) => {
    dispatch(setExhibitionField({ field, value }))
    setSaved(false)
    saveTrack.edited()
  }

  const windowFrameColor = useSelector(
    (state: RootState) => state.exhibition.windowFrameColor ?? DEFAULT_WINDOW_FRAME_COLOR,
  )
  const radiatorColor = useSelector(
    (state: RootState) => state.exhibition.radiatorColor ?? DEFAULT_RADIATOR_COLOR,
  )

  const handleSave = async () => {
    if (!exhibitionId) return

    setSaving(true)
    const sentAt = saveTrack.started()
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windowFrameColor, radiatorColor }),
      })

      if (response.ok) {
        setSaved(true)
      }
      saveTrack.finished(sentAt, response.ok)
    } catch (error) {
      console.error('Failed to save window settings:', error)
      saveTrack.finished(sentAt, false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ToolPanel
      title="Windows"
      description="Window frames and radiators."
      icon={GridFour}
      tint="windows"
      onClose={() => dispatch(hideWindowsPanel())}
      save={{ saving, saved, onSave: handleSave, status: saveTrack.status }}
    >
      {/* One color for every window frame in the space */}
      <ColorPicker
        variant="row"
        name="Window frames"
        textColor={windowFrameColor}
        onColorSelect={(color) => set('windowFrameColor', color)}
      />

      {/* Radiators — they sit under the windows */}
      <ColorPicker
        variant="row"
        name="Radiators"
        textColor={radiatorColor}
        onColorSelect={(color) => set('radiatorColor', color)}
      />
    </ToolPanel>
  )
}

export default WindowsPanel
