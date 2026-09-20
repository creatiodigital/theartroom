'use client'

import { useGLTF } from '@react-three/drei'
import { Fragment, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { SettingsPanel } from '@/components/editview/SettingsPanel'
import { getSpaceConfig, type SpaceKey } from '@/components/scene/constants'
import { getNodeIndices } from '@/components/scene/spaces/objects/nodeIndices'
import {
  isPanelEnabled,
  panelColorOf,
  type PanelSettings,
} from '@/components/scene/spaces/objects/Panel/panelSettings'
import { Button } from '@/components/ui/Button'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection/CollapsibleSection'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Slider } from '@/components/ui/Slider'
import { Text } from '@/components/ui/Typography'
import { Toggle } from '@/components/ui/Toggle'
import { hidePanelsPanel } from '@/redux/slices/dashboardSlice'
import { setPanelSettings } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

import styles from './PanelsPanel.module.scss'

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

  const { nodes } = useGLTF(getSpaceConfig(spaceId || 'paris').gltfPath) as unknown as {
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
  }

  const handleSave = async () => {
    if (!exhibitionId) return
    setSaving(true)
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
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsPanel title="Display Panels" onClose={() => dispatch(hidePanelsPanel())}>
      <Text font="dashboard" as="p" size="xs" className={styles.hint}>
        {panelIndices.length === 0
          ? 'This space has no display panels.'
          : 'Switch a panel on, then move or turn it. Anything hung on it moves too.'}
      </Text>

      {panelsByRoom.map(([room, indices]) => {
        const rows = indices.map((index, position) => {
          const settings = panelSettings?.[String(index)]
          const enabled = isPanelEnabled(settings)
          const count = artworkCounts[index] ?? 0
          // Numbering restarts inside each room — the section header above
          // already says which room these belong to.
          const label = `Panel ${position + 1}`

          return (
            <div key={index} className={styles.panelRow}>
              <div className={styles.panelHeader}>
                <span className={styles.panelLabel}>{label}</span>
                <Toggle
                  checked={enabled}
                  onChange={() => patch(index, { enabled: !enabled })}
                  aria-label={`${label} visible`}
                />
              </div>

              {count > 0 && (
                <span className={styles.artworkCount}>
                  {count} {count === 1 ? 'artwork' : 'artworks'}
                  {enabled ? '' : ' hidden with this panel'}
                </span>
              )}

              <div className={styles.panelSlider}>
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

              <div className={styles.panelSlider}>
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

              <div className={styles.panelSlider}>
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

              <div className={styles.colorRow}>
                <span className={styles.sliderLabel}>Color</span>
                <ColorPicker
                  textColor={panelColorOf(settings)}
                  onColorSelect={(color) => patch(index, { color })}
                />
              </div>
            </div>
          )
        })

        if (panelsByRoom.length < 2) return <Fragment key={room}>{rows}</Fragment>

        return (
          <CollapsibleSection
            key={room}
            title={`Room ${room + 1} · ${indices.length} ${indices.length === 1 ? 'panel' : 'panels'}`}
            persistKey={`display-panels-room${room}`}
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

export default PanelsPanel
