'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { PaintRoller } from '@phosphor-icons/react'

import { ColorPicker } from '@/components/ui/ColorPicker'
import {
  PanelCard,
  SliderRow,
  ToolPanel,
  useSaveTracking,
  useSavedMoment,
} from '@/components/editorChrome'
import { isBakedSpace } from '@/lib/bake/bakedSpaces'
import { hideWallCeilingPanel } from '@/redux/slices/dashboardSlice'
import { setExhibitionField } from '@/redux/slices/exhibitionSlice'
import type { TExhibition } from '@/types/exhibition'
import type { RootState } from '@/redux/store'

const DEFAULT_WALL_COLOR = '#ffffff'
const DEFAULT_CEILING_COLOR = '#ffffff'

const WallCeilingPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useSavedMoment()

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  // Display only (questions.md Q131, Q139 b): the Save area's "Unsaved changes" / "Not saved".
  const saveTrack = useSaveTracking(exhibitionId ? `${exhibitionId}:walls` : null)

  const set = (field: keyof TExhibition, value: TExhibition[keyof TExhibition]) => {
    dispatch(setExhibitionField({ field, value }))
    setSaved(false)
    saveTrack.edited()
  }

  // AR-161 (spec rule 7): in a baked space the wall and ceiling paint are the artist's (the bake
  // takes both colors; the ceiling since Eduardo 2026-10-20); the walls' brightness is the light's,
  // the space's.
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId)
  const bakedSpace = isBakedSpace(spaceId)
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
    const sentAt = saveTrack.started()
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // A baked space's panel saves only what it shows.
        body: JSON.stringify(
          bakedSpace ? { wallColor, ceilingColor } : { wallColor, ceilingColor, wallBrightness },
        ),
      })

      if (response.ok) {
        setSaved(true)
      }
      saveTrack.finished(sentAt, response.ok)
    } catch (error) {
      console.error('Failed to save wall & ceiling settings:', error)
      saveTrack.finished(sentAt, false)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    dispatch(hideWallCeilingPanel())
  }

  return (
    <ToolPanel
      title="Walls & ceiling"
      description="The paint colors of the room."
      icon={PaintRoller}
      tint="walls"
      onClose={handleClose}
      save={{ saving, saved, onSave: handleSave, status: saveTrack.status }}
    >
      <ColorPicker
        variant="row"
        name="Walls"
        textColor={wallColor}
        onColorSelect={(color) => set('wallColor', color)}
      />
      <ColorPicker
        variant="row"
        name="Ceiling"
        textColor={ceilingColor}
        onColorSelect={(color) => set('ceilingColor', color)}
      />

      {/* Temporary: Lambert Brightness Boost */}
      {!bakedSpace && (
        <PanelCard level="card">
          <SliderRow
            label="Wall brightness"
            value={wallBrightness.toFixed(2)}
            sliderValue={wallBrightness}
            min={1.0}
            max={5.0}
            step={0.05}
            onChange={(v) => set('wallBrightness', v)}
          />
        </PanelCard>
      )}
    </ToolPanel>
  )
}

export default WallCeilingPanel
