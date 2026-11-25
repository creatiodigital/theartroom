'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Plane, Ray, Raycaster, Vector2, Vector3 } from 'three'

import { floorBridge } from '@/components/floorview/floorBridge'
import type { FloorLayout } from '@/lib/floor/floorLayout'
import { descendantsOf, raiseBy } from '@/lib/floor/floorPlacement'
import { selectFloorItems } from '@/redux/slices/floorSlice'
import type { RootState } from '@/redux/store'

/** Below this, a press is a click: it picks, it never moves (as the plan and the works on the walls). */
const CLICK_MAX_MOVE_PX = 5

/**
 * The Floor view's live 3D: a press on an item moves it (a picked item itself; otherwise the start
 * of its chain, which it picks; while a pick from the list holds, that pick) ONLY up and down (owner,
 * 2026-11-25: "use the 3D view only to move the object up and down"), with what is attached to
 * it. Placing and attaching happen on the plan and in the Inspector. Release keeps it (one undo
 * step); Escape puts it back. The room's camera never sees that press.
 */
export function useFloorDrag(layout: FloorLayout | null, floorY: number) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const dispatch = useDispatch()
  const selectedIds = useSelector((state: RootState) => state.floor.selectedIds)
  const cleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanup.current?.(), [])

  return useCallback(
    (event: ThreeEvent<PointerEvent>, pressed: string) => {
      if (event.button !== 0 || !layout || !floorBridge.editor) return
      event.stopPropagation()
      cleanup.current?.()
      const byId = new Map(layout.items.map((i) => [i.id, i]))
      // What the press moves: picked in the list, that pick holds (a press on any item moves it);
      // a picked item, itself; otherwise the start of its chain, picked now: a press on the Bust
      // on its plank moves the plank, and the Bust with it (owner, 2026-11-25: "if I click on the
      // child, make it move the parent, not the room").
      let id = pressed
      if (floorBridge.lockPick && selectedIds.length > 0 && !selectedIds.includes(pressed)) {
        id = selectedIds[0]
      } else if (!selectedIds.includes(pressed)) {
        let root = byId.get(pressed)
        for (let steps = 0; root?.parentId && byId.has(root.parentId) && steps < 200; steps++)
          root = byId.get(root.parentId)
        id = root?.id ?? pressed
      }
      const picked = selectedIds.includes(id) ? selectedIds : floorBridge.expand([id])
      if (!selectedIds.includes(id)) dispatch(selectFloorItems(picked))
      const item = byId.get(id)
      if (!item || item.locked) return
      const start = { x: event.clientX, y: event.clientY }
      const moved = (e: PointerEvent) =>
        Math.hypot(e.clientX - start.x, e.clientY - start.y) >= CLICK_MAX_MOVE_PX

      // Picked: up and down. The room's camera listens to the mouse events that follow a press
      // (R3F's own listener is passive, so this press can't be cancelled): the one mousedown is
      // stopped before it reaches the camera.
      const block = (e: MouseEvent) => e.stopPropagation()
      window.addEventListener('mousedown', block, { capture: true, once: true })
      const ids = picked.length > 1 ? picked : [id]
      // What rides on a moved item is carried by it, never moved twice.
      const riding = new Set(ids.flatMap((i) => [...descendantsOf(layout, i)]))
      const grab = new Vector3(event.point.x, event.point.y - floorY, event.point.z)
      floorBridge.editor.beginDrag(ids)
      const raycaster = new Raycaster()
      const move = (e: PointerEvent) => {
        const editor = floorBridge.editor
        if (!editor || !moved(e)) return
        const r = gl.domElement.getBoundingClientRect()
        raycaster.setFromCamera(
          new Vector2(
            ((e.clientX - r.left) / r.width) * 2 - 1,
            -((e.clientY - r.top) / r.height) * 2 + 1,
          ),
          camera,
        )
        const origin = raycaster.ray.origin.clone()
        origin.y -= floorY
        const ray = new Ray(origin, raycaster.ray.direction.clone())
        // A vertical plane through where it was grabbed, facing the camera.
        const facing = new Vector3(ray.direction.x, 0, ray.direction.z)
        if (facing.lengthSq() < 1e-9) return
        const plane = new Plane().setFromNormalAndCoplanarPoint(facing.normalize(), grab)
        const p = ray.intersectPlane(plane, new Vector3())
        if (!p) return
        const dy = (p.y - grab.y) * 100
        editor.previewItems((items) =>
          items.map((i) =>
            ids.includes(i.id) && !i.locked && !riding.has(i.id) ? raiseBy(i, dy) : i,
          ),
        )
      }
      const up = () => {
        cleanup.current?.()
        floorBridge.editor?.endPreview()
      }
      const key = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return
        cleanup.current?.()
        floorBridge.editor?.cancelDrag()
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('keydown', key)
      cleanup.current = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('keydown', key)
        window.removeEventListener('mousedown', block, { capture: true })
        cleanup.current = null
      }
    },
    [layout, floorY, selectedIds, camera, gl, dispatch],
  )
}
