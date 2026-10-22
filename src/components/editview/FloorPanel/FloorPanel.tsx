'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { Section } from '@/components/ui/Section/Section'
import { Slider } from '@/components/ui/Slider'
import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { isBakedSpace } from '@/lib/bake/bakedSpaces'
import { bakedFloorTiling, type FloorTiling } from '@/lib/bake/commonFloor'
import { spaceLooks } from '@/lib/bake/spaceLooks'
import { hideFloorPanel } from '@/redux/slices/dashboardSlice'
import { setExhibitionField } from '@/redux/slices/exhibitionSlice'
import type { TExhibition } from '@/types/exhibition'
import type { RootState } from '@/redux/store'

import styles from './FloorPanel.module.scss'

const DEFAULT_FLOOR_REFLECTIVENESS = 0.3
const DEFAULT_FLOOR_TEXTURE_SCALE = 2.0

const FLOOR_MATERIALS = [
  { value: 'concrete', label: 'Concrete' },
  { value: 'patterned-concrete', label: 'Patterned Concrete' },
  { value: 'worn-concrete', label: 'Worn Concrete' },
  { value: 'concrete-tiles', label: 'Concrete Tiles' },
  { value: 'dark-concrete', label: 'Dark Concrete' },
  { value: 'marble', label: 'Marble' },
  { value: 'parquet', label: 'Parquet' },
  { value: 'parquet-light', label: 'Parquet Light' },
  { value: 'parquet-soft', label: 'Parquet Soft' },
  { value: 'parquet-white', label: 'Parquet White' },
  { value: 'wood-planks', label: 'Wood Planks' },
  { value: 'clear-wood', label: 'Clear Wood' },
] as const

const FloorPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const set = (field: keyof TExhibition, value: TExhibition[keyof TExhibition]) => {
    dispatch(setExhibitionField({ field, value }))
    setSaved(false)
  }

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
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

  const floorTemperature = useSelector((state: RootState) => state.exhibition.floorTemperature ?? 0)

  const floorNormalScale = useSelector(
    (state: RootState) => state.exhibition.floorNormalScale ?? 1.0,
  )

  const floorRotation = useSelector((state: RootState) => state.exhibition.floorRotation ?? 0)

  // AR-163: a baked space has one floor, the space's (AR-161 spec rule 3); the boards' size and
  // placement are the artist's again (`bakedFloorTiling`). Moving one stores the space's floor
  // with the whole tiling, so the tiling counts from then on.
  const bakedFloor =
    spaceId && isBakedSpace(spaceId) ? (spaceLooks[spaceId]?.look.floor ?? null) : null
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
  const tileScale = Math.max(0.5, Math.min(8.0, tiling.textureScale))
  const setTiling = (patch: Partial<FloorTiling>) => {
    const next = bakedFloor ? { ...tiling, ...patch } : patch
    if (bakedFloor) set('floorMaterial', bakedFloor.material)
    if (next.textureScale !== undefined) set('floorTextureScale', next.textureScale)
    if (next.offsetX !== undefined) set('floorTextureOffsetX', next.offsetX)
    if (next.offsetY !== undefined) set('floorTextureOffsetY', next.offsetY)
    if (next.rotation !== undefined) set('floorRotation', next.rotation)
  }

  const handleSave = async () => {
    if (!exhibitionId) return

    setSaving(true)
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
    } catch (error) {
      console.error('Failed to save floor settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    dispatch(hideFloorPanel())
  }

  const tileControls = (
    <>
      <div className={styles.field}>
        <div className={styles.sliderHeader}>
          <label className={styles.label}>Tile Scale</label>
          <span className={styles.sliderValue}>{(8.5 - tileScale).toFixed(2)}</span>
        </div>
        <Slider
          min={0.5}
          max={8}
          step={0.01}
          value={8.5 - tileScale}
          onChange={(v) => setTiling({ textureScale: 8.5 - v })}
          aria-label="Tile Scale"
        />
      </div>

      <div className={styles.field}>
        <div className={styles.sliderHeader}>
          <label className={styles.label}>Tile Position X</label>
          <span className={styles.sliderValue}>{tiling.offsetX.toFixed(2)}</span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={tiling.offsetX}
          onChange={(v) => setTiling({ offsetX: v })}
          aria-label="Tile Position X"
        />
      </div>

      <div className={styles.field}>
        <div className={styles.sliderHeader}>
          <label className={styles.label}>Tile Position Y</label>
          <span className={styles.sliderValue}>{tiling.offsetY.toFixed(2)}</span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={tiling.offsetY}
          onChange={(v) => setTiling({ offsetY: v })}
          aria-label="Tile Position Y"
        />
      </div>

      <div className={styles.field}>
        <div className={styles.sliderHeader}>
          <label className={styles.label}>Floor Rotation</label>
          <span className={styles.sliderValue}>{tiling.rotation.toFixed(0)}°</span>
        </div>
        <Slider
          min={0}
          max={360}
          step={1}
          value={tiling.rotation}
          onChange={(v) => setTiling({ rotation: v })}
          aria-label="Floor Rotation"
        />
      </div>
    </>
  )

  // A baked space: the boards only — the floor itself, its surface and its color are the space's.
  if (bakedFloor)
    return (
      <SettingsPanel title="Floor" onClose={handleClose}>
        <Section title="Tiles">{tileControls}</Section>
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

  return (
    <SettingsPanel title="Floor" onClose={handleClose}>
      <Section title="Material">
        <div className={styles.field}>
          <label className={styles.label}>Type</label>
          <select
            value={floorMaterial}
            onChange={(e) => set('floorMaterial', e.target.value)}
            className={styles.select}
          >
            {FLOOR_MATERIALS.map((material) => (
              <option key={material.value} value={material.value}>
                {material.label}
              </option>
            ))}
          </select>
        </div>

        {tileControls}
      </Section>

      <Section title="Surface">
        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Reflectiveness</label>
            <span className={styles.sliderValue}>{floorReflectiveness.toFixed(2)}</span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={floorReflectiveness}
            onChange={(v) => set('floorReflectiveness', v)}
            aria-label="Reflectiveness"
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Floor Details</label>
            <span className={styles.sliderValue}>{floorNormalScale.toFixed(2)}</span>
          </div>
          <Slider
            min={0}
            max={5}
            step={0.1}
            value={floorNormalScale}
            onChange={(v) => set('floorNormalScale', v)}
            aria-label="Floor Details"
          />
        </div>

        <div className={styles.field}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>Color Temperature</label>
            <span className={styles.sliderValue}>{floorTemperature.toFixed(2)}</span>
          </div>
          <Slider
            min={-1}
            max={1}
            step={0.05}
            value={floorTemperature}
            onChange={(v) => set('floorTemperature', v)}
            aria-label="Color Temperature"
          />
        </div>
      </Section>

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

export default FloorPanel
