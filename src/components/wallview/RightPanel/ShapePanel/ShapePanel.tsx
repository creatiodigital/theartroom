'use client'

import { useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { SliderRow } from '@/components/editorChrome'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { PanelGroup, SelectField } from '@/components/wallview/chrome'
import { editArtwork } from '@/redux/slices/artworkSlice'
import { pushToHistory } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'
import PresetSection from '../PresetSection/PresetSection'

const shapeTypes = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
]

const ShapePanel = ({ disabled }: { disabled?: boolean }) => {
  const dispatch = useDispatch()
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const artwork = useSelector((state: RootState) =>
    currentArtworkId ? state.artworks.byId[currentArtworkId] : null,
  )

  const handleChange = useCallback(
    <K extends keyof TArtwork>(property: K, value: TArtwork[K]) => {
      if (!currentArtworkId) return
      dispatch(pushToHistory())
      dispatch(editArtwork({ currentArtworkId, property, value }))
    },
    [currentArtworkId, dispatch],
  )

  if (!artwork) return null

  const shapeType = artwork.shapeType ?? 'rectangle'
  const shapeColor = artwork.shapeColor ?? '#000000'
  const shapeOpacity = artwork.shapeOpacity ?? 1

  return (
    <>
      <PanelGroup title="Shape" disabled={disabled}>
        <SelectField<string>
          label="Shape type"
          options={shapeTypes}
          value={shapeType}
          onChange={(val) => handleChange('shapeType', val)}
        />
        <ColorPicker
          variant="inline"
          name="Color"
          textColor={shapeColor}
          onColorSelect={(color) => handleChange('shapeColor', color)}
        />
        <SliderRow
          label="Opacity"
          value={`${Math.round(shapeOpacity * 100)}%`}
          sliderValue={shapeOpacity}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => handleChange('shapeOpacity', v)}
        />
      </PanelGroup>

      <PanelGroup title="Preset" disabled={disabled}>
        <PresetSection presetType="shape" />
      </PanelGroup>
    </>
  )
}

export { ShapePanel }
