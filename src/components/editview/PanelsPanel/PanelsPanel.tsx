'use client'

import { useGLTF } from '@react-three/drei'
import { Fragment, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Columns } from '@phosphor-icons/react'

import {
  PanelCard,
  PanelSection,
  SliderRow,
  SwitchRow,
  ToolPanel,
  metres,
  useSaveTracking,
} from '@/components/editorChrome'
import { getSpaceConfig, type SpaceKey } from '@/components/scene/constants'
import { getNodeIndices } from '@/components/scene/spaces/objects/nodeIndices'
import {
  isPanelEnabled,
  panelColorOf,
  type PanelSettings,
} from '@/components/scene/spaces/objects/Panel/panelSettings'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { hidePanelsPanel } from '@/redux/slices/dashboardSlice'
import { setPanelSettings } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

import { spaceGltfUrl } from '@/components/scene/spaceAsset'

/** How far a panel may be nudged from where Blender put it, in metres. */
const MOVE_RANGE = 15

/**
 * Panels are numbered in blocks of ten, one block per room, so the room a
 * panel belongs to is just its index divided by ten. No need to inspect the
 * GLB hierarchy — which is gone by the time this panel renders anyway.
 */
const roomOfPanel = (index: number) => Math.floor(index / 10)

const PanelsPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const panelSettings = useSelector((state: RootState) => state.exhibition.panelSettings)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  // Display only (questions.md Q131, Q139 b): the Save area's "Unsaved changes" / "Not saved".
  const saveTrack = useSaveTracking(exhibitionId ? `${exhibitionId}:panels` : null)

  const { nodes } = useGLTF(
    spaceGltfUrl(getSpaceConfig(spaceId || 'paris').gltfPath),
  ) as unknown as {
    nodes: Record<string, unknown>
  }
  const panelIndices = useMemo(() => getNodeIndices(nodes, 'panel'), [nodes])

  // Grouped by room, the way the lamps are. Panels are numbered in blocks of
  // ten, one block per room, so the grouping falls straight out of the index —
  // no need for the GLB hierarchy, which is gone by the time this renders.
  const panelsByRoom = useMemo(() => {
    const groups = new Map<number, number[]>()
    for (const index of panelIndices) {
      const room = roomOfPanel(index)
      const bucket = groups.get(room)
      if (bucket) bucket.push(index)
      else groups.set(room, [index])
    }
    return [...groups.entries()].sort(([a], [b]) => a - b)
  }, [panelIndices])

  // How many artworks hang on each panel, so switching one off never quietly
  // takes a wall of work out of the show.
  const artworkCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const pos of Object.values(exhibitionArtworksById)) {
      const match = /^panel(?:Front|Back)(\d+)$/.exec(pos.wallId ?? '')
      if (!match) continue
      const index = Number(match[1])
      counts[index] = (counts[index] ?? 0) + 1
    }
    return counts
  }, [exhibitionArtworksById])

  const patch = (index: number, next: Partial<PanelSettings>) => {
    dispatch(setPanelSettings({ index, patch: next }))
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
        body: JSON.stringify({ panelSettings: panelSettings ?? null }),
      })
      if (response.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
      saveTrack.finished(sentAt, response.ok)
    } catch (error) {
      // As the other panels do: a network failure must not surface as an
      // unhandled rejection.
      console.error('Failed to save panel settings:', error)
      saveTrack.finished(sentAt, false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ToolPanel
      title="Display panels"
      description={
        panelIndices.length === 0
          ? 'This space has no display panels.'
          : 'Switch a panel on, then move or turn it. Anything hung on it moves too.'
      }
      icon={Columns}
      tint="walls"
      onClose={() => dispatch(hidePanelsPanel())}
      save={{ saving, saved, onSave: handleSave, status: saveTrack.status }}
    >
      {panelsByRoom.map(([room, indices]) => {
        const rows = indices.map((index, position) => {
          const settings = panelSettings?.[String(index)]
          const enabled = isPanelEnabled(settings)
          const count = artworkCounts[index] ?? 0
          // Numbering restarts inside each room — the section header above
          // already says which room these belong to.
          const label = `Panel ${position + 1}`
          // Accessible names (questions.md Q135): the visible words, with the room where two
          // rooms each have a "Panel 1".
          const who = panelsByRoom.length < 2 ? label : `Room ${room + 1} · ${label}`

          // Not folded when off (only benches fold; questions.md Q137).
          return (
            <PanelCard key={index} level={panelsByRoom.length < 2 ? 'card' : 'group'}>
              <SwitchRow
                title={label}
                line={
                  count > 0 && (
                    <>
                      {count} {count === 1 ? 'artwork' : 'artworks'}
                      {enabled ? '' : ' hidden with this panel'}
                    </>
                  )
                }
                checked={enabled}
                onChange={() => patch(index, { enabled: !enabled })}
                aria-label={panelsByRoom.length < 2 ? undefined : who}
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

              <ColorPicker
                variant="inline"
                name="Color"
                aria-label={`${who} color`}
                textColor={panelColorOf(settings)}
                onColorSelect={(color) => patch(index, { color })}
              />
            </PanelCard>
          )
        })

        if (panelsByRoom.length < 2) return <Fragment key={room}>{rows}</Fragment>

        const on = indices.filter((index) => isPanelEnabled(panelSettings?.[String(index)])).length

        // Each panel a white card on the room's grey (Lighting's "All lamps" / "Each lamp").
        return (
          <PanelSection
            key={room}
            title={`Room ${room + 1} · ${indices.length} ${indices.length === 1 ? 'panel' : 'panels'}`}
            summary={`${on} on`}
            storageKey={`collapsible-display-panels-room${room}`}
            defaultOpen
          >
            {rows}
          </PanelSection>
        )
      })}
    </ToolPanel>
  )
}

export default PanelsPanel
