'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Camera } from '@phosphor-icons/react'

import {
  PanelCard,
  SliderRow,
  ToolPanel,
  metres,
  useSaveTracking,
  useSavedMoment,
} from '@/components/editorChrome'
import { hideCameraPanel } from '@/redux/slices/dashboardSlice'
import { setExhibitionField } from '@/redux/slices/exhibitionSlice'
import type { TExhibition } from '@/types/exhibition'
import type { RootState } from '@/redux/store'

const DEFAULT_CAMERA_FOV = 50
const DEFAULT_CAMERA_ELEVATION = 1.6

const CameraPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useSavedMoment()

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  // Display only (questions.md Q131, Q139 b): the Save area's "Unsaved changes" / "Not saved".
  const saveTrack = useSaveTracking(exhibitionId ? `${exhibitionId}:view` : null)

  const set = (field: keyof TExhibition, value: TExhibition[keyof TExhibition]) => {
    dispatch(setExhibitionField({ field, value }))
    setSaved(false)
    saveTrack.edited()
  }

  const cameraFOV = useSelector(
    (state: RootState) => state.exhibition.cameraFOV ?? DEFAULT_CAMERA_FOV,
  )

  const cameraElevation = useSelector(
    (state: RootState) => state.exhibition.cameraElevation ?? DEFAULT_CAMERA_ELEVATION,
  )

  const handleSave = async () => {
    if (!exhibitionId) return

    setSaving(true)
    const sentAt = saveTrack.started()
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
      saveTrack.finished(sentAt, response.ok)
    } catch (error) {
      console.error('Failed to save camera settings:', error)
      saveTrack.finished(sentAt, false)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    dispatch(hideCameraPanel())
  }

  return (
    <ToolPanel
      title="View"
      description="How visitors see the room as they walk."
      icon={Camera}
      tint="view"
      onClose={handleClose}
      save={{ saving, saved, onSave: handleSave, status: saveTrack.status }}
    >
      <PanelCard level="card">
        <SliderRow
          label="Field of view"
          value={`${cameraFOV.toFixed(0)}°`}
          sliderValue={cameraFOV}
          min={40}
          max={60}
          step={1}
          onChange={(v) => set('cameraFOV', v)}
          ends={['Narrow', 'Wide']}
        />
        <SliderRow
          label="Eye level"
          value={metres(cameraElevation, 2)}
          sliderValue={cameraElevation}
          min={1.5}
          max={1.7}
          step={0.01}
          onChange={(v) => set('cameraElevation', v)}
          ends={['Lower', 'Higher']}
        />
      </PanelCard>
    </ToolPanel>
  )
}

export default CameraPanel
