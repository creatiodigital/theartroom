'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import {
  EMPTY_FLOOR,
  type FloorItem,
  type FloorLayout,
  type FloorObject,
  type FloorPedestal,
} from '@/lib/floor/floorLayout'
import { dropObject, placeAll, type Placed } from '@/lib/floor/floorPlacement'
import { setFloorLayout } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

/**
 * The Floor view's working copy (docs/objects O6). Every change goes straight into the exhibition's
 * `floorLayout`, so the live 3D shows it; the view keeps its own undo / redo and the last saved
 * floor for Cancel. A drag is one undo step: `beginDrag` records where everything was, `dragTo`
 * previews, `endDrag` settles (snapping Objects to pedestals unless Alt).
 */
export function useFloorEditor() {
  const dispatch = useDispatch()
  const layout = useSelector((state: RootState) => state.exhibition.floorLayout) ?? EMPTY_FLOOR
  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const [past, setPast] = useState<FloorLayout[]>([])
  const [future, setFuture] = useState<FloorLayout[]>([])
  const [saved, setSaved] = useState<FloorLayout>(layout)
  const [saving, setSaving] = useState(false)
  const drag = useRef<{ before: FloorLayout; at: Map<string, Placed>; ids: string[] } | null>(null)

  const apply = useCallback((next: FloorLayout) => dispatch(setFloorLayout(next)), [dispatch])

  /** One undoable change. */
  const commit = useCallback(
    (next: FloorLayout) => {
      setPast((p) => [...p.slice(-99), layout])
      setFuture([])
      apply(next)
    },
    [layout, apply],
  )

  const update = useCallback(
    (fn: (items: FloorItem[]) => FloorItem[], groups = layout.groups) =>
      commit({ ...layout, items: fn(layout.items), groups }),
    [layout, commit],
  )

  const patchItem = useCallback(
    (id: string, patch: Partial<FloorObject> | Partial<FloorPedestal>) =>
      update((items) => items.map((i) => (i.id === id ? ({ ...i, ...patch } as FloorItem) : i))),
    [update],
  )

  const undo = useCallback(() => {
    const prev = past[past.length - 1]
    if (!prev) return
    setPast((p) => p.slice(0, -1))
    setFuture((f) => [layout, ...f])
    apply(prev)
  }, [past, layout, apply])

  const redo = useCallback(() => {
    const next = future[0]
    if (!next) return
    setFuture((f) => f.slice(1))
    setPast((p) => [...p, layout])
    apply(next)
  }, [future, layout, apply])

  // ── Dragging ──
  const beginDrag = useCallback(
    (ids: string[]) => {
      const at = new Map(placeAll(layout).map(({ item, at }) => [item.id, at]))
      drag.current = { before: layout, at, ids }
    },
    [layout],
  )

  /** Preview a move of the dragged items by (dx, dz) metres from where they started. */
  const dragTo = useCallback(
    (dx: number, dz: number) => {
      const d = drag.current
      if (!d) return
      const ids = new Set(d.ids)
      const items = d.before.items.map((item) => {
        if (!ids.has(item.id) || item.locked) return item
        const start = d.at.get(item.id)
        if (!start) return item
        if (item.kind === 'pedestal') return { ...item, x: start.x + dx, z: start.z + dz }
        // On a pedestal that moves too: it rides along.
        if (item.pedestalId && ids.has(item.pedestalId)) return item
        // Free while dragged, at the height it was seen at.
        return {
          ...item,
          x: start.x + dx,
          z: start.z + dz,
          rotY: start.rotY,
          lift: Math.round(start.y * 1000) / 10,
          pedestalId: null,
          offsetX: 0,
          offsetZ: 0,
        }
      })
      apply({ ...d.before, items })
    },
    [apply],
  )

  /** Settle the drag: each moved Object lands on the pedestal under it, or on the floor. */
  const endDrag = useCallback(
    (snapToPedestals: boolean) => {
      const d = drag.current
      drag.current = null
      if (!d) return
      const ids = new Set(d.ids)
      const moved = layout
      const before = new Map(d.before.items.map((i) => [i.id, i]))
      const items = moved.items.map((item) => {
        if (item.kind !== 'object' || !ids.has(item.id)) return item
        const original = before.get(item.id) as FloorObject | undefined
        if (!original || item.locked) return item
        if (original.pedestalId && ids.has(original.pedestalId)) return original
        return dropObject(moved, original, item.x, item.z, { snap: snapToPedestals })
      })
      const next = { ...moved, items }
      // A click is not a change.
      if (JSON.stringify(next) === JSON.stringify(d.before)) {
        apply(d.before)
        return
      }
      setPast((p) => [...p.slice(-99), d.before])
      setFuture([])
      apply(next)
    },
    [layout, apply],
  )

  /** Preview any change to the items from where the drag began (a turn by the handle). */
  const previewItems = useCallback(
    (fn: (items: FloorItem[]) => FloorItem[]) => {
      const d = drag.current
      if (d) apply({ ...d.before, items: fn(d.before.items) })
    },
    [apply],
  )

  const cancelDrag = useCallback(() => {
    const d = drag.current
    drag.current = null
    if (d) apply(d.before)
  }, [apply])

  // ── Save / Cancel ──
  const dirty = useMemo(() => JSON.stringify(layout) !== JSON.stringify(saved), [layout, saved])

  const save = useCallback(async (): Promise<string | null> => {
    if (!exhibitionId) return 'No exhibition'
    setSaving(true)
    try {
      const res = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floorLayout: layout }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return data.error ?? 'The floor could not be saved.'
      }
      setSaved(layout)
      return null
    } catch {
      return 'The floor could not be saved.'
    } finally {
      setSaving(false)
    }
  }, [exhibitionId, layout])

  /** Back to the last saved floor. */
  const revert = useCallback(() => {
    apply(saved)
    setPast([])
    setFuture([])
  }, [apply, saved])

  return {
    layout,
    commit,
    update,
    patchItem,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    beginDrag,
    dragTo,
    endDrag,
    previewItems,
    cancelDrag,
    dirty,
    saving,
    save,
    revert,
  }
}

export type FloorEditor = ReturnType<typeof useFloorEditor>
