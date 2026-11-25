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
import { floorSizes } from '@/lib/floor/floorArtworks'
import {
  descendantsOf,
  detachItem,
  dropItem,
  placeMap,
  sameSpots,
  slideOnFace,
  type Placed,
} from '@/lib/floor/floorPlacement'
import { setFloorLayout } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'

/**
 * The Floor view's working copy (docs/objects O6). Every change goes straight into the exhibition's
 * `floorLayout`, so the live 3D shows it; the view keeps its own undo / redo and the last saved
 * floor for Cancel. A drag is one undo step: `beginDrag` records where everything was, `dragTo`
 * previews, `endDrag` settles (snapping Objects to pedestals unless Alt), `endPreview` keeps a
 * preview as it is (a turn by the handle, a drag in the live 3D).
 */
export function useFloorEditor() {
  const dispatch = useDispatch()
  const layout = useSelector((state: RootState) => state.exhibition.floorLayout) ?? EMPTY_FLOOR
  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  const artworks = useSelector((state: RootState) => state.exhibition.floorArtworks)
  const sizes = useMemo(() => floorSizes(artworks), [artworks])
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
      drag.current = { before: layout, at: placeMap(layout, sizes), ids }
    },
    [layout, sizes],
  )

  /**
   * Preview a move of the dragged items by (dx, dz) metres from where they started. What is
   * attached to a dragged item rides along. A free item moves across the floor; an Object on a top
   * comes off while dragged (it lands on release, as O6); any other attached item slides on its
   * face, unless `free` (Alt): then it comes off too, at the height it was seen at.
   */
  const dragTo = useCallback(
    (dx: number, dz: number, { free = false }: { free?: boolean } = {}) => {
      const d = drag.current
      if (!d) return
      const ids = new Set(d.ids)
      const riding = new Set(d.ids.flatMap((id) => [...descendantsOf(d.before, id)]))
      const items = d.before.items.map((item): FloorItem => {
        if (!ids.has(item.id) || item.locked || riding.has(item.id)) return item
        const start = d.at.get(item.id)
        if (!start) return item
        if (!item.parentId) return { ...item, x: start.x + dx, z: start.z + dz }
        const parent = item.parentId ? d.at.get(item.parentId) : undefined
        if (free || !parent || (item.kind === 'object' && item.face === 'top')) {
          const off = detachItem(d.before, item, sizes)
          return { ...off, x: start.x + dx, z: start.z + dz }
        }
        return slideOnFace(item, parent, dx, dz)
      })
      apply({ ...d.before, items })
    },
    [apply, sizes],
  )

  /** One undo step from where the drag began to `next` (none for a click). */
  const settle = useCallback(
    (before: FloorLayout, next: FloorLayout) => {
      if (JSON.stringify(next) === JSON.stringify(before)) {
        apply(before)
        return
      }
      setPast((p) => [...p.slice(-99), before])
      setFuture([])
      apply(next)
    },
    [apply],
  )

  /**
   * Settle the drag: each moved item that came off its face (or was free) lands where it was
   * dropped: an Object on the support under it or against a side (`sideTolCm`), or on the floor.
   */
  const endDrag = useCallback(
    (snapToPedestals: boolean, sideTolCm = 0) => {
      const d = drag.current
      drag.current = null
      if (!d) return
      // A click picks; it never drops (or attaches) what did not move.
      if (sameSpots(d.before, layout, d.ids)) {
        apply(d.before)
        return
      }
      const ids = new Set(d.ids)
      const moved = layout
      const before = new Map(d.before.items.map((i) => [i.id, i]))
      const riding = new Set(d.ids.flatMap((id) => [...descendantsOf(d.before, id)]))
      const items = moved.items.map((item) => {
        if (!ids.has(item.id) || item.parentId || riding.has(item.id)) return item
        const original = before.get(item.id)
        if (!original || item.locked) return item
        return dropItem(moved, original, item.x, item.z, sizes, {
          snap: snapToPedestals,
          sideTolCm,
        })
      })
      settle(d.before, { ...moved, items })
    },
    [apply, layout, settle, sizes],
  )

  /** Keep the preview as it is, as one undo step. */
  const endPreview = useCallback(() => {
    const d = drag.current
    drag.current = null
    if (d) settle(d.before, layout)
  }, [layout, settle])

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
    endPreview,
    previewItems,
    cancelDrag,
    dirty,
    saving,
    save,
    revert,
    sizes,
  }
}

export type FloorEditor = ReturnType<typeof useFloorEditor>
