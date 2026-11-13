'use client'

import { Fragment, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Armchair } from '@phosphor-icons/react'

import {
  ChoiceTiles,
  InfoLine,
  PanelCard,
  PanelSection,
  SliderRow,
  SwitchRow,
  ToolPanel,
  metres,
  useSaveTracking,
  useSavedMoment,
} from '@/components/editorChrome'
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
import { hideFurniturePanel } from '@/redux/slices/dashboardSlice'
import { setBenchSettings } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

/** How far a bench may be moved from the middle of its room, in metres. */
const MOVE_RANGE = 15

const FurniturePanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useSavedMoment()

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const benchSettings = useSelector((state: RootState) => state.exhibition.benchSettings)
  const { rooms } = useBenchRooms()
  // Display only (questions.md Q131, Q139 b): the Save area's "Unsaved changes" / "Not saved".
  const saveTrack = useSaveTracking(exhibitionId ? `${exhibitionId}:benches` : null)

  const patch = (index: number, next: Partial<BenchSettings>) => {
    dispatch(setBenchSettings({ index, patch: next }))
    setSaved(false)
    saveTrack.edited()
  }

  const handleSave = async () => {
    if (!exhibitionId) return
    setSaving(true)
    const sentAt = saveTrack.started()
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benchSettings: benchSettings ?? null }),
      })
      if (response.ok) {
        setSaved(true)
      }
      saveTrack.finished(sentAt, response.ok)
    } catch (error) {
      // As the other panels do: a network failure must not surface as an
      // unhandled rejection.
      console.error('Failed to save furniture settings:', error)
      saveTrack.finished(sentAt, false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ToolPanel
      title="Benches"
      description="Switch a bench on, pick a model, then move or turn it."
      icon={Armchair}
      tint="benches"
      onClose={() => dispatch(hideFurniturePanel())}
      save={{ saving, saved, onSave: handleSave, status: saveTrack.status }}
    >
      {rooms.map(({ room }) => {
        const rows = Array.from({ length: BENCHES_PER_ROOM }, (_, slot) => {
          const index = benchIndex(room, slot)
          const settings = benchSettings?.[String(index)]
          const enabled = isBenchEnabled(settings)
          const label = `Bench ${slot + 1}`
          // Accessible names (questions.md Q135): the visible words, with the room where two
          // rooms each have a "Bench 1".
          const who = rooms.length < 2 ? label : `Room ${room + 1} · ${label}`

          // NEW (editor3d.md): an off bench folds to its name, "Off" and the switch. The switch
          // stays the card's first child either way, so focus stays on it as the card folds.
          return (
            <PanelCard key={index} level={rooms.length < 2 ? 'card' : 'group'}>
              <SwitchRow
                title={label}
                line={enabled ? undefined : 'Off'}
                checked={enabled}
                onChange={() => patch(index, { enabled: !enabled })}
                aria-label={rooms.length < 2 ? undefined : who}
              />

              {enabled && (
                <>
                  <ChoiceTiles
                    label={`${who} model`}
                    options={BENCH_MODELS}
                    value={benchModelOf(settings)}
                    onChange={(m) => patch(index, { model: m as BenchModel })}
                  />

                  <SliderRow
                    label="Across"
                    aria-label={`${who} across`}
                    value={metres(settings?.x ?? 0, 2)}
                    sliderValue={settings?.x ?? 0}
                    min={-MOVE_RANGE}
                    max={MOVE_RANGE}
                    step={0.05}
                    onChange={(v) => patch(index, { x: v })}
                    disabled={!enabled}
                  />

                  <SliderRow
                    label="Depth"
                    aria-label={`${who} depth`}
                    value={metres(settings?.z ?? 0, 2)}
                    sliderValue={settings?.z ?? 0}
                    min={-MOVE_RANGE}
                    max={MOVE_RANGE}
                    step={0.05}
                    onChange={(v) => patch(index, { z: v })}
                    disabled={!enabled}
                  />

                  <SliderRow
                    label="Turn"
                    aria-label={`${who} turn`}
                    value={`${settings?.rotationY ?? 0}°`}
                    sliderValue={settings?.rotationY ?? 0}
                    min={-180}
                    max={180}
                    step={1}
                    onChange={(v) => patch(index, { rotationY: v })}
                    disabled={!enabled}
                  />
                </>
              )}
            </PanelCard>
          )
        })

        // One room: no room section around the benches, so they sit straight in the body.
        if (rooms.length < 2) {
          return <Fragment key={room}>{rows}</Fragment>
        }

        const on = Array.from({ length: BENCHES_PER_ROOM }, (_, slot) =>
          benchIndex(room, slot),
        ).filter((index) => isBenchEnabled(benchSettings?.[String(index)])).length

        // Each bench a white card on the room's grey (Lighting's "All lamps" / "Each lamp").
        return (
          <PanelSection
            key={room}
            title={`Room ${room + 1} · ${BENCHES_PER_ROOM} benches`}
            summary={`${on} on`}
            storageKey={`collapsible-furniture-room${room}`}
            defaultOpen
          >
            {rows}
          </PanelSection>
        )
      })}

      <InfoLine>
        Benches are baked with the room: bake again after a change to see their shadows.
      </InfoLine>
    </ToolPanel>
  )
}

export default FurniturePanel
