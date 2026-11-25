'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Plane, Ray, Raycaster, Vector2, Vector3 } from 'three'

import { floorBridge } from '@/components/floorview/floorBridge'
import type { FloorSizes } from '@/lib/floor/floorArtworks'
import type { FloorFace, FloorLayout } from '@/lib/floor/floorLayout'
import { attachTo, descendantsOf, faceUnderRay } from '@/lib/floor/floorPlacement'
import { selectFloorItems } from '@/redux/slices/floorSlice'
import type { RootState } from '@/redux/store'

/** A click, not a drag (as the plan and the works on the walls). */
const CLICK_MAX_MOVE_PX = 5
const CLICK_MAX_MS = 300

export type FaceHover = { id: string; face: FloorFace } | null

/**
 * Composing in the Floor view's live 3D (floor composing, "Builder check: calls made" 5): a click
 * on an item picks it (its ⌘G group); a press on a picked item drags it, and the room's camera
 * never sees that press. A single item dragged over another item's face lands against it (on its
 * own parent's face it slides); over nothing it moves across the room at the level it was grabbed
 * (coming off what it was on, at the height it is seen); Shift moves a free item up and down; Alt
 * never attaches. A picked ⌘G group moves across the room as one. Release keeps it (one undo
 * step); Escape puts it back. `hover` is the face it would land on, for the highlight.
 */
export function useFloorDrag(layout: FloorLayout | null, sizes: FloorSizes, floorY: number) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const dispatch = useDispatch()
  const selectedIds = useSelector((state: RootState) => state.floor.selectedIds)
  const [hover, setHover] = useState<FaceHover>(null)
  const cleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanup.current?.(), [])

  const onDown = useCallback(
    (event: ThreeEvent<PointerEvent>, id: string) => {
      if (event.button !== 0 || !layout || !floorBridge.editor) return
      event.stopPropagation()
      cleanup.current?.()
      const start = { x: event.clientX, y: event.clientY, at: Date.now() }
      const moved = (e: PointerEvent) =>
        Math.hypot(e.clientX - start.x, e.clientY - start.y) >= CLICK_MAX_MOVE_PX
      const item = layout.items.find((i) => i.id === id)
      if (!item || !selectedIds.includes(id) || item.locked) {
        // Not picked: a click picks it; a drag looks around, as anywhere in the room.
        const up = (e: PointerEvent) => {
          cleanup.current?.()
          if (!moved(e) && Date.now() - start.at < CLICK_MAX_MS)
            dispatch(selectFloorItems(floorBridge.expand([id])))
        }
        window.addEventListener('pointerup', up)
        cleanup.current = () => {
          window.removeEventListener('pointerup', up)
          cleanup.current = null
        }
        return
      }

      // Picked: it moves. The room's camera listens to the mouse events that follow a press
      // (R3F's own listener is passive, so this press can't be cancelled): the one mousedown is
      // stopped before it reaches the camera.
      const block = (e: MouseEvent) => e.stopPropagation()
      window.addEventListener('mousedown', block, { capture: true, once: true })
      const group = selectedIds.length > 1
      const ids = group ? selectedIds : [id]
      const before = layout
      const exclude = new Set(ids.flatMap((i) => [i, ...descendantsOf(before, i)]))
      const grab = new Vector3(event.point.x, event.point.y - floorY, event.point.z)
      // Where the press's ray meets the floor (or the grab's level): the drag's start on that plane.
      const floor = new Plane(new Vector3(0, 1, 0), 0)
      const atGrab = new Plane(new Vector3(0, 1, 0), -grab.y)
      const pressRay = new Ray(
        event.ray.origin.clone().setY(event.ray.origin.y - floorY),
        event.ray.direction.clone(),
      )
      const floorStart = pressRay.intersectPlane(floor, new Vector3())
      const levelHit = (ray: Ray) => {
        const onFloor = floorStart && ray.intersectPlane(floor, new Vector3())
        if (floorStart && onFloor) return Object.assign(onFloor, { from: floorStart })
        const onLevel = ray.intersectPlane(atGrab, new Vector3())
        return onLevel && Object.assign(onLevel, { from: grab })
      }
      floorBridge.editor.beginDrag(ids)
      const raycaster = new Raycaster()
      // The pointer's ray, in the floor's coordinates (y from the floor).
      const rayAt = (e: PointerEvent) => {
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
        return new Ray(origin, raycaster.ray.direction.clone())
      }

      // The last move across the room, kept while Shift raises or lowers.
      let across = { dx: 0, dz: 0 }
      const move = (e: PointerEvent) => {
        const editor = floorBridge.editor
        if (!editor || !moved(e)) return
        const ray = rayAt(e)
        if (!group && !e.altKey && !e.shiftKey) {
          const hit = faceUnderRay(before, sizes, ray, item.room, exclude)
          if (hit) {
            const on = attachTo(before, item, hit.id, hit.face, hit.point, sizes)
            editor.previewItems((items) => items.map((i) => (i.id === id ? on : i)))
            setHover({ id: hit.id, face: hit.face })
            return
          }
        }
        setHover(null)
        if (e.shiftKey) {
          // Up and down: a vertical plane through where it was grabbed, facing the camera.
          const n = new Vector3(ray.direction.x, 0, ray.direction.z)
          if (n.lengthSq() < 1e-9) return
          const plane = new Plane().setFromNormalAndCoplanarPoint(n.normalize(), grab)
          const p = ray.intersectPlane(plane, new Vector3())
          if (!p) return
          const dy = (p.y - grab.y) * 100
          editor.previewItems((items) =>
            items.map((i) =>
              ids.includes(i.id) && !i.parentId
                ? {
                    ...i,
                    x: i.x + across.dx,
                    z: i.z + across.dz,
                    lift: Math.max(0, Math.min(1000, i.lift + dy)),
                  }
                : i,
            ),
          )
          return
        }
        // Across the room: by where the pointer meets the floor (a level plane near the eye would
        // throw it far), or the level it was grabbed at when the pointer is above the horizon.
        const p = levelHit(ray)
        if (!p) return
        across = { dx: p.x - p.from.x, dz: p.z - p.from.z }
        editor.dragTo(across.dx, across.dz, { free: true })
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
        setHover(null)
        cleanup.current = null
      }
    },
    [layout, sizes, floorY, selectedIds, camera, gl, dispatch],
  )

  return { onDown, hover }
}
