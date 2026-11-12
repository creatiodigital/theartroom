'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Rows } from '@phosphor-icons/react'

import { AdminSelect } from '@/components/admin/ui/AdminSelect'
import { PanelCard, SliderRow, ToolPanel, useSaveTracking } from '@/components/editorChrome'
import { isBakedSpace } from '@/lib/bake/bakedSpaces'
import {
  BAKED_FLOORS,
  bakedFloor as bakedFloorOf,
  bakedFloorTiling,
  bakedFloorTone,
  boardWidthCm,
  textureScaleForBoardWidth,
  type FloorTiling,
} from '@/lib/bake/commonFloor'
import { spaceLooks } from '@/lib/bake/spaceLooks'
import { hideFloorPanel } from '@/redux/slices/dashboardSlice'
import { setExhibitionField } from '@/redux/slices/exhibitionSlice'
import type { TExhibition } from '@/types/exhibition'
import type { RootState } from '@/redux/store'

const DEFAULT_FLOOR_REFLECTIVENESS = 0.3
const DEFAULT_FLOOR_TEXTURE_SCALE = 2.0

const FLOOR_MATERIALS = [
  { value: 'concrete', label: 'Concrete' },
  { value: 'patterned-concrete', label: 'Patterned concrete' },
  { value: 'worn-concrete', label: 'Worn concrete' },
  { value: 'concrete-tiles', label: 'Concrete tiles' },
  { value: 'dark-concrete', label: 'Dark concrete' },
  { value: 'marble', label: 'Marble' },
  { value: 'parquet', label: 'Parquet' },
  { value: 'parquet-light', label: 'Parquet light' },
  { value: 'parquet-soft', label: 'Parquet soft' },
  { value: 'parquet-white', label: 'Parquet white' },
  { value: 'wood-planks', label: 'Wood planks' },
  { value: 'clear-wood', label: 'Clear wood' },
] as const

/**
 * AR-169: the names of the baked floors (`BAKED_FLOORS`). Kept here, not on `CommonFloor`: the
 * space's look hashes its floor object (`spaceLookVersion`), so a new field there stales every bake.
 */
const BAKED_FLOOR_LABELS: Record<string, string> = {
  'white-oak': 'White oak',
  'parquet-medium': 'Parquet medium',
  'parquet-ash': 'Parquet ash',
}

const FloorPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  // Display only (questions.md Q131, Q139 b): the Save area's "Unsaved changes" / "Not saved".
  const saveTrack = useSaveTracking(exhibitionId ? `${exhibitionId}:floor` : null)

  const set = (field: keyof TExhibition, value: TExhibition[keyof TExhibition]) => {
    dispatch(setExhibitionField({ field, value }))
    setSaved(false)
    saveTrack.edited()
  }

  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId)

  const floorReflectiveness = useSelector(
    (state: RootState) => state.exhibition.floorReflectiveness ?? DEFAULT_FLOOR_REFLECTIVENESS,
  )

  const floorMaterial = useSelector(
    (state: RootState) => state.exhibition.floorMaterial ?? 'concrete',
  )

  // Clamp to valid range 0.5-5.0 in case of legacy values
  const rawFloorTextureScale = useSelector(
    (state: RootState) => state.exhibition.floorTextureScale ?? DEFAULT_FLOOR_TEXTURE_SCALE,
  )
  const floorTextureScale = Math.max(0.5, Math.min(8.0, rawFloorTextureScale))

  const floorTextureOffsetX = useSelector(
    (state: RootState) => state.exhibition.floorTextureOffsetX ?? 0,
  )

  const floorTextureOffsetY = useSelector(
    (state: RootState) => state.exhibition.floorTextureOffsetY ?? 0,
  )

  const storedTemperature = useSelector((state: RootState) => state.exhibition.floorTemperature)
  const floorTemperature = storedTemperature ?? 0

  const floorNormalScale = useSelector(
    (state: RootState) => state.exhibition.floorNormalScale ?? 1.0,
  )

  const floorRotation = useSelector((state: RootState) => state.exhibition.floorRotation ?? 0)

  // AR-163: a baked space has one floor, the space's (AR-161 spec rule 3); the boards' size and
  // placement are the artist's again (`bakedFloorTiling`), and its tone (AR-169, `bakedFloorTone`,
  // stored as `floorTemperature`). Moving one stores the space's floor with the whole tiling and
  // the tone, so they count from then on — never a value left from an earlier floor.
  const spaceFloor = spaceId && isBakedSpace(spaceId) ? spaceLooks[spaceId]?.look.floor : undefined
  // AR-169: one of the baked floors — the stored one when it is a baked floor (`bakedFloorOf`).
  const bakedFloor = spaceFloor ? bakedFloorOf(spaceFloor, floorMaterial) : null
  const tiling: FloorTiling = bakedFloor
    ? bakedFloorTiling(bakedFloor, {
        floorMaterial,
        floorTextureScale: rawFloorTextureScale,
        floorTextureOffsetX,
        floorTextureOffsetY,
        floorRotation,
      })
    : {
        textureScale: floorTextureScale,
        offsetX: floorTextureOffsetX,
        offsetY: floorTextureOffsetY,
        rotation: floorRotation,
      }
  const tone = bakedFloor
    ? bakedFloorTone(bakedFloor, { floorMaterial, floorTemperature: storedTemperature })
    : 0
  const tileScale = Math.max(0.5, Math.min(8.0, tiling.textureScale))
  const setTiling = (patch: Partial<FloorTiling> & { tone?: number }) => {
    const next = bakedFloor ? { ...tiling, tone, ...patch } : patch
    if (bakedFloor) set('floorMaterial', bakedFloor.material)
    if (next.textureScale !== undefined) set('floorTextureScale', next.textureScale)
    if (next.offsetX !== undefined) set('floorTextureOffsetX', next.offsetX)
    if (next.offsetY !== undefined) set('floorTextureOffsetY', next.offsetY)
    if (next.rotation !== undefined) set('floorRotation', next.rotation)
    if (next.tone !== undefined) set('floorTemperature', next.tone)
  }
  // AR-169: another baked floor. Its boards start at its own width (a tile holds a different number
  // of boards per floor, so the old scale would lay other widths); placement and tone carry over.
  const chooseFloor = (material: string) => {
    const floor = BAKED_FLOORS.find((f) => f.material === material)
    if (!floor || !bakedFloor || floor.material === bakedFloor.material) return
    set('floorMaterial', floor.material)
    set('floorTextureScale', floor.textureScale)
    set('floorTextureOffsetX', tiling.offsetX)
    set('floorTextureOffsetY', tiling.offsetY)
    set('floorRotation', tiling.rotation)
    set('floorTemperature', tone)
  }

  const handleSave = async () => {
    if (!exhibitionId) return

    setSaving(true)
    const sentAt = saveTrack.started()
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          floorMaterial,
          floorTextureScale,
          floorTextureOffsetX,
          floorTextureOffsetY,
          floorRotation,
          floorTemperature,
          floorNormalScale,
          floorReflectiveness,
        }),
      })

      if (response.ok) {
        setSaved(true)
      }
      saveTrack.finished(sentAt, response.ok)
    } catch (error) {
      console.error('Failed to save floor settings:', error)
      saveTrack.finished(sentAt, false)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    dispatch(hideFloorPanel())
  }

  const tileScaleControl = (
    <SliderRow
      label="Tile scale"
      value={(8.5 - tileScale).toFixed(2)}
      sliderValue={8.5 - tileScale}
      min={0.5}
      max={8}
      step={0.01}
      onChange={(v) => setTiling({ textureScale: 8.5 - v })}
    />
  )

  const tilePlacementControls = (
    <>
      <SliderRow
        label="Shift across"
        value={tiling.offsetX.toFixed(2)}
        sliderValue={tiling.offsetX}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => setTiling({ offsetX: v })}
      />

      <SliderRow
        label="Shift along"
        value={tiling.offsetY.toFixed(2)}
        sliderValue={tiling.offsetY}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => setTiling({ offsetY: v })}
      />

      <SliderRow
        label="Rotation"
        value={`${tiling.rotation.toFixed(0)}°`}
        sliderValue={tiling.rotation}
        min={0}
        max={360}
        step={1}
        onChange={(v) => setTiling({ rotation: v })}
      />
    </>
  )

  const panel = {
    title: 'Floor',
    icon: Rows,
    tint: 'floor',
    onClose: handleClose,
    save: { saving, saved, onSave: handleSave, status: saveTrack.status },
  } as const

  // A baked space: one of the baked floors, the wood's tone and the boards — its surface is the
  // floor's own.
  if (bakedFloor) {
    const boardWidth = boardWidthCm(bakedFloor, tiling.textureScale)
    return (
      <ToolPanel {...panel} description="The wood and how its boards are laid.">
        <PanelCard level="card" title="Wood">
          {/* No floor has a color or a small thumbnail for the drawn tiles: the select, restyled
              (questions.md Q136). */}
          <AdminSelect
            label="Type"
            id="baked-floor-type"
            size="form"
            value={bakedFloor.material}
            onChange={(value) => chooseFloor(value)}
          >
            {BAKED_FLOORS.map((floor) => (
              <option key={floor.material} value={floor.material}>
                {BAKED_FLOOR_LABELS[floor.material] ?? floor.material}
              </option>
            ))}
          </AdminSelect>
          <SliderRow
            label="Tone"
            value={`${Math.round(tone * 100)}%`}
            sliderValue={tone}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setTiling({ tone: v })}
            ends={['Natural', 'Honey']}
            track="tone"
          />
        </PanelCard>
        <PanelCard level="card" title="Boards">
          <SliderRow
            label="Board width"
            value={`${Math.round(boardWidth)} cm`}
            sliderValue={boardWidth}
            min={bakedFloor.boardWidth.min}
            max={bakedFloor.boardWidth.max}
            step={1}
            onChange={(v) => setTiling({ textureScale: textureScaleForBoardWidth(bakedFloor, v) })}
          />
          {tilePlacementControls}
        </PanelCard>
      </ToolPanel>
    )
  }

  return (
    <ToolPanel {...panel} description="The floor's material and how it is laid.">
      <PanelCard level="card" title="Material">
        <AdminSelect
          label="Type"
          size="form"
          value={floorMaterial}
          onChange={(value) => set('floorMaterial', value)}
        >
          {FLOOR_MATERIALS.map((material) => (
            <option key={material.value} value={material.value}>
              {material.label}
            </option>
          ))}
        </AdminSelect>

        {tileScaleControl}
        {tilePlacementControls}
      </PanelCard>

      <PanelCard level="card" title="Surface">
        <SliderRow
          label="Reflectiveness"
          value={floorReflectiveness.toFixed(2)}
          sliderValue={floorReflectiveness}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set('floorReflectiveness', v)}
        />

        <SliderRow
          label="Floor details"
          value={floorNormalScale.toFixed(2)}
          sliderValue={floorNormalScale}
          min={0}
          max={5}
          step={0.1}
          onChange={(v) => set('floorNormalScale', v)}
        />

        <SliderRow
          label="Color temperature"
          value={floorTemperature.toFixed(2)}
          sliderValue={floorTemperature}
          min={-1}
          max={1}
          step={0.05}
          onChange={(v) => set('floorTemperature', v)}
        />
      </PanelCard>
    </ToolPanel>
  )
}

export default FloorPanel
