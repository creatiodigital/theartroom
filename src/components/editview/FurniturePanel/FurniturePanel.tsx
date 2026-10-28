'use client'

import { Fragment, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { SettingsPanel } from '@/components/editview/SettingsPanel'
import {
  BENCH_MODELS,
  BENCHES_PER_ROOM,
  benchIndex,
  benchModelOf,
  isBenchEnabled,
  useBenchRooms,
  type BenchModel,
  type BenchSettings,
} from '@/components/scene/spaces/objects/Bench/benchSettings'
import { Button } from '@/components/ui/Button'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection/CollapsibleSection'
import { Slider } from '@/components/ui/Slider'
import { Text } from '@/components/ui/Typography'
import { Toggle } from '@/components/ui/Toggle'
import { hideFurniturePanel } from '@/redux/slices/dashboardSlice'
import { setBenchSettings } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

import styles from './FurniturePanel.module.scss'

/** How far a bench may be moved from the middle of its room, in metres. */
const MOVE_RANGE = 15

const FurniturePanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const benchSettings = useSelector((state: RootState) => state.exhibition.benchSettings)
  const { rooms } = useBenchRooms()

  const patch = (index: number, next: Partial<BenchSettings>) => {
    dispatch(setBenchSettings({ index, patch: next }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!exhibitionId) return
    setSaving(true)
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benchSettings: benchSettings ?? null }),
      })
      if (response.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsPanel title="Furniture" onClose={() => dispatch(hideFurniturePanel())}>
      <Text font="dashboard" as="p" size="xs" className={styles.hint}>
        Switch a bench on, pick a model, then move or turn it. Benches are baked with the room: bake
        again after a change to see their shadows.
      </Text>

      {rooms.map(({ room }) => {
        const rows = Array.from({ length: BENCHES_PER_ROOM }, (_, slot) => {
          const index = benchIndex(room, slot)
          const settings = benchSettings?.[String(index)]
          const enabled = isBenchEnabled(settings)
          const label = `Bench ${slot + 1}`

          return (
            <div key={index} className={styles.benchRow}>
              <div className={styles.benchHeader}>
                <span className={styles.benchLabel}>{label}</span>
                <Toggle
                  checked={enabled}
                  onChange={() => patch(index, { enabled: !enabled })}
                  aria-label={`${label} visible`}
                />
              </div>

              <div className={styles.benchSlider}>
                <span className={styles.sliderLabel}>Model</span>
                <select
                  value={benchModelOf(settings)}
                  onChange={(e) => patch(index, { model: e.target.value as BenchModel })}
                  disabled={!enabled}
                  className={styles.select}
                  aria-label={`${label} model`}
                >
                  {BENCH_MODELS.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.benchSlider}>
                <span className={styles.sliderLabel}>Across</span>
                <Slider
                  min={-MOVE_RANGE}
                  max={MOVE_RANGE}
                  step={0.05}
                  value={settings?.x ?? 0}
                  onChange={(v) => patch(index, { x: v })}
                  disabled={!enabled}
                  aria-label={`${label} position across the room`}
                />
                <span className={styles.sliderValue}>{(settings?.x ?? 0).toFixed(2)}m</span>
              </div>

              <div className={styles.benchSlider}>
                <span className={styles.sliderLabel}>Depth</span>
                <Slider
                  min={-MOVE_RANGE}
                  max={MOVE_RANGE}
                  step={0.05}
                  value={settings?.z ?? 0}
                  onChange={(v) => patch(index, { z: v })}
                  disabled={!enabled}
                  aria-label={`${label} position into the room`}
                />
                <span className={styles.sliderValue}>{(settings?.z ?? 0).toFixed(2)}m</span>
              </div>

              <div className={styles.benchSlider}>
                <span className={styles.sliderLabel}>Turn</span>
                <Slider
                  min={-180}
                  max={180}
                  step={1}
                  value={settings?.rotationY ?? 0}
                  onChange={(v) => patch(index, { rotationY: v })}
                  disabled={!enabled}
                  aria-label={`${label} rotation`}
                />
                <span className={styles.sliderValue}>{settings?.rotationY ?? 0}°</span>
              </div>
            </div>
          )
        })

        if (rooms.length < 2) return <Fragment key={room}>{rows}</Fragment>

        return (
          <CollapsibleSection
            key={room}
            title={`Room ${room + 1} · ${BENCHES_PER_ROOM} benches`}
            persistKey={`furniture-room${room}`}
            defaultOpen
          >
            {rows}
          </CollapsibleSection>
        )
      })}

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

export default FurniturePanel
