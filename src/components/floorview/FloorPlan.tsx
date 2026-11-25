'use client'

import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import { useSelector } from 'react-redux'
import c from 'classnames'

import type { FloorSizes } from '@/lib/floor/floorArtworks'
import type { FloorItem, FloorLayout } from '@/lib/floor/floorLayout'
import {
  belowFloor,
  descendantsOf,
  faceFrame,
  movingWith,
  overhangs,
  placeAll,
  placeMap,
  planOutline,
  sideAgainst,
  supportUnder,
  type Placed,
} from '@/lib/floor/floorPlacement'
import type { RootState } from '@/redux/store'

import type { FloorEditor } from './useFloorEditor'
import type { FloorRoom } from './useFloorRooms'
import styles from './FloorView.module.scss'

/**
 * The plan (docs/objects O6, objects-floor-view-draft.dc.html): the room seen from above, in cm
 * (x right, z down: the room's world axes). Pedestals are their outline, Objects their footprint,
 * both turned as they stand (a tilted item: its box seen from above), higher items over lower ones.
 * Click picks (Shift adds), drag moves (snapping to align and, on release, Objects onto a pedestal's
 * top or a raised side; Alt never snaps; an item on a side slides along it), the handle turns
 * (15° steps, Shift free).
 */
export const DRAG_TYPE = 'application/x-floor-add'

/** The plan's zoom range (×): 20 shows a 3 cm plank's depth. */
export const PLAN_ZOOM = { min: 0.5, max: 20 }

type PlanPoint = { x: number; z: number }

const MARGIN_CM = 80
const SNAP_PX = 8
const ROTATE_STEP = 15
/** On-screen sizes (px), turned into plan cm by `px`. */
const TEXT_PX = 11
const HANDLE_GAP_PX = 26
const HANDLE_R_PX = 7
/** Every item can be picked within this many px of its centre, however small it is drawn. */
const HIT_R_PX = 12

type Props = {
  room: FloorRoom
  editor: FloorEditor
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  /** A picked group member brings its group (Shift picks single items). */
  expand: (ids: string[]) => string[]
  /** Something dragged in from the add bar landed at (x, z) metres. */
  onDropAdd: (payload: string, x: number, z: number) => void
  zoom: number
  /** Picked in the list: the map never picks another item (owner, 2026-11-25: "lock it"). */
  lockPick: boolean
  /** The view's centre (plan cm); null: the room's centre. */
  centre: PlanPoint | null
  /** A pinch or a scroll on the plan, or a drag on its background: the new zoom and centre. */
  onView: (zoom: number, centre: PlanPoint) => void
}

/** How far the turning handle stands from the centre (cm): past the item's reach toward its back. */
const reachOf = (at: Placed) =>
  at.upright ? at.size.d / 2 : Math.max(at.max.x - at.min.x, at.max.z - at.min.z) * 50

export function FloorPlan({
  room,
  editor,
  selectedIds,
  onSelect,
  expand,
  onDropAdd,
  zoom,
  lockPick,
  centre,
  onView,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const helpers = useSelector((state: RootState) => state.floor.helpers)
  const [guides, setGuides] = useState<{ x: number | null; z: number | null }>({ x: null, z: null })
  const editorRef = useRef(editor)
  editorRef.current = editor
  const helpersRef = useRef(helpers)
  helpersRef.current = helpers

  const layout: FloorLayout = editor.layout
  const { sizes } = editor
  // Lower items first, so what stands higher is drawn over them.
  const placed = useMemo(
    () =>
      placeAll(layout, sizes)
        .filter(({ item }) => item.room === room.room)
        .sort((a, b) => a.at.max.y - b.at.max.y),
    [layout, room.room, sizes],
  )
  const atById = useMemo(() => new Map(placed.map(({ item, at }) => [item.id, at])), [placed])

  // The view: the room and a margin, zoomed, around `centre` (the room's centre until moved).
  const fullW = (room.maxX - room.minX) * 100 + MARGIN_CM * 2
  const fullH = (room.maxZ - room.minZ) * 100 + MARGIN_CM * 2
  const viewW = fullW / zoom
  const viewH = fullH / zoom
  const c0 = centre ?? { x: room.centreX * 100, z: room.centreZ * 100 }
  const viewBox = `${c0.x - viewW / 2} ${c0.z - viewH / 2} ${viewW} ${viewH}`
  // For the wheel and pan listeners: the view as it is now, never past the room's walls.
  const viewRef = useRef({ zoom, c: c0, room })
  viewRef.current = { zoom, c: c0, room }
  const onViewRef = useRef(onView)
  onViewRef.current = onView
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const lockPickRef = useRef(lockPick)
  lockPickRef.current = lockPick
  const setView = (z: number, c: PlanPoint) => {
    const r = viewRef.current.room
    onViewRef.current(z, {
      x: Math.min(r.maxX * 100, Math.max(r.minX * 100, c.x)),
      z: Math.min(r.maxZ * 100, Math.max(r.minZ * 100, c.z)),
    })
  }

  // How many cm one screen pixel is: labels and handles keep their size whatever the zoom.
  const [px, setPx] = useState(1)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const { width, height } = svg.getBoundingClientRect()
      if (width > 0 && height > 0) setPx(Math.max(viewW / width, viewH / height))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [viewW, viewH])
  const text = { fontSize: TEXT_PX * px }

  /** A pointer event → plan cm, and how many cm one screen pixel is. */
  const toPlan = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return { x: 0, z: 0, perPx: 1 }
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
    return { x: p.x, z: p.y, perPx: 1 / ctm.a }
  }

  // ── Zooming and moving the view ──
  // A pinch (or ⌘ / Ctrl + scroll) zooms at the pointer; a scroll moves the view.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const { zoom: z, c } = viewRef.current
      const p = toPlan(event.clientX, event.clientY)
      if (event.ctrlKey || event.metaKey) {
        const next = Math.min(
          PLAN_ZOOM.max,
          Math.max(PLAN_ZOOM.min, z * Math.exp(-event.deltaY * 0.01)),
        )
        // The point under the pointer stays under it.
        const k = z / next
        setView(next, { x: p.x + (c.x - p.x) * k, z: p.z + (c.z - p.z) * k })
      } else {
        setView(z, { x: c.x + event.deltaX * p.perPx, z: c.z + event.deltaY * p.perPx })
      }
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
    // toPlan and setView read refs only.
  }, [])

  // A drag on the plan's background moves the view; a click there unpicks.
  const panStart = useRef<{
    x: number
    y: number
    c: PlanPoint
    perPx: number
    moved: boolean
  } | null>(null)
  const onBackgroundDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const p = toPlan(event.clientX, event.clientY)
    panStart.current = { x: event.clientX, y: event.clientY, c: c0, perPx: p.perPx, moved: false }
  }
  useEffect(() => {
    const onMove = (event: globalThis.PointerEvent) => {
      const s = panStart.current
      if (!s) return
      const dx = event.clientX - s.x
      const dy = event.clientY - s.y
      if (!s.moved && Math.hypot(dx, dy) < 3) return
      s.moved = true
      setView(viewRef.current.zoom, { x: s.c.x - dx * s.perPx, z: s.c.z - dy * s.perPx })
    }
    const onUp = () => {
      const s = panStart.current
      panStart.current = null
      // A click on the background unpicks, unless the pick came from the list (it holds until
      // another is picked there).
      if (s && !s.moved && !lockPickRef.current) onSelectRef.current([])
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // setView reads refs only.
  }, [])

  // ── Moving ──
  // `others`: the centres a drag snaps to, taken when it starts, never what it moves (an item
  // riding along on the dragged one would pull it back to where it just was: the guides blinked).
  const moveStart = useRef<{
    x: number
    z: number
    lead: Placed
    leadId: string
    others: { x: number; z: number }[]
  } | null>(null)

  const onItemDown = (event: PointerEvent, pressed: FloorItem) => {
    event.stopPropagation()
    if (event.button !== 0) return
    // Picked in the list: a press on any item moves what is picked; the map never picks another.
    const locked =
      lockPick && !event.shiftKey && selectedIds.length > 0 && !selectedIds.includes(pressed.id)
    const item = locked ? (layout.items.find((i) => i.id === selectedIds[0]) ?? pressed) : pressed
    const already = selectedIds.includes(item.id)
    const ids = event.shiftKey
      ? already
        ? selectedIds.filter((id) => id !== item.id)
        : [...selectedIds, item.id]
      : already
        ? selectedIds
        : expand([item.id])
    if (!locked) onSelect(ids)
    if (event.shiftKey || item.locked) return
    const lead = atById.get(item.id)
    if (!lead) return
    const p = toPlan(event.clientX, event.clientY)
    const moving = movingWith(layout, ids)
    const others = placed
      .filter(({ item: i }) => !moving.has(i.id))
      .map(({ at }) => ({ x: at.x * 100, z: at.z * 100 }))
    moveStart.current = { x: p.x, z: p.z, lead, leadId: item.id, others }
    editor.beginDrag(ids)
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  useEffect(() => {
    const onMove = (event: globalThis.PointerEvent) => {
      const start = moveStart.current
      if (!start) return
      const p = toPlan(event.clientX, event.clientY)
      let dx = p.x - start.x
      let dz = p.z - start.z
      const next = { x: null as number | null, z: null as number | null }
      if (helpersRef.current.snapAlign && !event.altKey) {
        // The lead item's centre to other centres, the room's centre lines and its walls.
        const tol = SNAP_PX * p.perPx
        const cx = start.lead.x * 100 + dx
        const cz = start.lead.z * 100 + dz
        // Flush with a wall: the lead's own reach from its centre, as it is turned.
        const { lead } = start
        const xs = [
          room.centreX * 100,
          room.minX * 100 + (lead.x - lead.min.x) * 100,
          room.maxX * 100 - (lead.max.x - lead.x) * 100,
          ...start.others.map((o) => o.x),
        ]
        const zs = [
          room.centreZ * 100,
          room.minZ * 100 + (lead.z - lead.min.z) * 100,
          room.maxZ * 100 - (lead.max.z - lead.z) * 100,
          ...start.others.map((o) => o.z),
        ]
        const bestX = xs.reduce<number | null>(
          (b, v) =>
            Math.abs(v - cx) <= tol && (b === null || Math.abs(v - cx) < Math.abs(b - cx)) ? v : b,
          null,
        )
        const bestZ = zs.reduce<number | null>(
          (b, v) =>
            Math.abs(v - cz) <= tol && (b === null || Math.abs(v - cz) < Math.abs(b - cz)) ? v : b,
          null,
        )
        if (bestX !== null) {
          dx += bestX - cx
          next.x = bestX
        }
        if (bestZ !== null) {
          dz += bestZ - cz
          next.z = bestZ
        }
      }
      setGuides(next)
      editorRef.current.dragTo(dx / 100, dz / 100, { free: event.altKey })
    }
    const onUp = (event: globalThis.PointerEvent) => {
      if (!moveStart.current) return
      moveStart.current = null
      setGuides({ x: null, z: null })
      const tol = SNAP_PX * toPlan(event.clientX, event.clientY).perPx
      editorRef.current.endDrag(helpersRef.current.snapPedestals && !event.altKey, tol)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // toPlan reads the svg ref; the rest comes through refs.
  }, [room])

  // ── Turning ──
  const turnStart = useRef<{ id: string; a0: number; rot0: number; cx: number; cz: number } | null>(
    null,
  )
  const onHandleDown = (event: PointerEvent, item: FloorItem) => {
    event.stopPropagation()
    const at = atById.get(item.id)
    if (!at) return
    const p = toPlan(event.clientX, event.clientY)
    const cx = at.x * 100
    const cz = at.z * 100
    turnStart.current = {
      id: item.id,
      a0: (Math.atan2(p.z - cz, p.x - cx) * 180) / Math.PI,
      rot0: item.rotY,
      cx,
      cz,
    }
    editor.beginDrag([])
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }
  useEffect(() => {
    const onMove = (event: globalThis.PointerEvent) => {
      const t = turnStart.current
      if (!t) return
      const p = toPlan(event.clientX, event.clientY)
      const a = (Math.atan2(p.z - t.cz, p.x - t.cx) * 180) / Math.PI
      // On screen, z points down: a positive turn in the room is counter-clockwise here.
      let rot = t.rot0 - (a - t.a0)
      if (!event.shiftKey) rot = Math.round(rot / ROTATE_STEP) * ROTATE_STEP
      rot = ((((rot + 180) % 360) + 360) % 360) - 180
      editorRef.current.previewItems((items) =>
        items.map((i) => (i.id === t.id ? { ...i, rotY: rot } : i)),
      )
    }
    const onUp = () => {
      if (!turnStart.current) return
      turnStart.current = null
      // One undo step for the whole turn.
      editorRef.current.endPreview()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  // ── Adding by drop ──
  const onDragOver = (event: DragEvent) => {
    if (event.dataTransfer.types.includes(DRAG_TYPE)) event.preventDefault()
  }
  const onDrop = (event: DragEvent) => {
    const payload = event.dataTransfer.getData(DRAG_TYPE)
    if (!payload) return
    event.preventDefault()
    const p = toPlan(event.clientX, event.clientY)
    onDropAdd(payload, p.x / 100, p.z / 100)
  }

  const single =
    selectedIds.length === 1 ? placed.find(({ item }) => item.id === selectedIds[0]) : undefined
  const roomW = Math.round((room.maxX - room.minX) * 100)
  const roomD = Math.round((room.maxZ - room.minZ) * 100)

  return (
    <svg
      ref={svgRef}
      className={styles.planSvg}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onBackgroundDown}
      onDragOver={onDragOver}
      onDrop={onDrop}
      role="img"
      aria-label={`Plan of room ${room.room + 1}, ${roomW} × ${roomD} cm, seen from above`}
    >
      <rect
        x={room.minX * 100}
        y={room.minZ * 100}
        width={roomW}
        height={roomD}
        className={styles.planFloor}
      />
      {helpers.rulers && <Rulers room={room} px={px} />}
      {room.walls.map((w) => (
        <line
          key={w.name}
          x1={w.x1 * 100}
          y1={w.z1 * 100}
          x2={w.x2 * 100}
          y2={w.z2 * 100}
          className={styles.planWall}
        />
      ))}
      <text
        x={room.centreX * 100}
        y={room.minZ * 100 - 22 * px}
        className={styles.planDim}
        style={text}
        textAnchor="middle"
      >
        {roomW} cm
      </text>
      <text
        x={room.minX * 100 - 22 * px}
        y={room.centreZ * 100}
        className={styles.planDim}
        style={text}
        textAnchor="middle"
        transform={`rotate(-90 ${room.minX * 100 - 22 * px} ${room.centreZ * 100})`}
      >
        {roomD} cm
      </text>

      {guides.x !== null && (
        <line
          x1={guides.x}
          y1={room.minZ * 100}
          x2={guides.x}
          y2={room.maxZ * 100}
          className={styles.planGuide}
        />
      )}
      {guides.z !== null && (
        <line
          x1={room.minX * 100}
          y1={guides.z}
          x2={room.maxX * 100}
          y2={guides.z}
          className={styles.planGuide}
        />
      )}

      {/* Under every shape: an invisible circle round each item's centre, so a small item is
          picked as easily as a large one, but only where no shape is (owner, 2026-11-25: "very
          hard to move the pedestal if the artwork is close"). What is picked comes last. */}
      {[...placed]
        .sort(
          (a, b) =>
            Number(selectedIds.includes(a.item.id)) - Number(selectedIds.includes(b.item.id)),
        )
        .map(({ item, at }) => (
          <circle
            key={`hit-${item.id}`}
            cx={at.x * 100}
            cy={at.z * 100}
            r={HIT_R_PX * px}
            className={styles.planHit}
            onPointerDown={(e) => onItemDown(e, item)}
          />
        ))}

      {/* Lower items first; what is picked last of all, so a press on it always reaches it
          (owner, 2026-11-25: picking the pedestal in the list, then dragging it on the plan,
          picked the Bust on its front instead). */}
      {[...placed]
        .sort(
          (a, b) =>
            Number(selectedIds.includes(a.item.id)) - Number(selectedIds.includes(b.item.id)),
        )
        .map(({ item, at }) => {
          const selected = selectedIds.includes(item.id)
          const points = planOutline(item, at)
            .map(([x, z]) => `${x},${z}`)
            .join(' ')
          return (
            <g
              key={item.id}
              className={c(
                styles.planItem,
                selected && styles.planSelected,
                (overhangs(layout, item, sizes) || belowFloor(at)) && styles.planOverhang,
              )}
              onPointerDown={(e) => onItemDown(e, item)}
            >
              <polygon
                points={points}
                className={item.kind === 'pedestal' ? styles.planPedestal : styles.planObject}
              />
              {item.kind === 'object' && at.upright && (
                // The front: a short line toward the model's +z.
                <line
                  x1={0}
                  y1={at.size.d / 2 - 4}
                  x2={0}
                  y2={at.size.d / 2}
                  transform={`translate(${at.x * 100} ${at.z * 100}) rotate(${-at.rotY})`}
                  className={styles.planFront}
                />
              )}
            </g>
          )
        })}

      {/* The picked item: its distances to the west and north walls, and the turning handle. */}
      {single && (
        <>
          <line
            x1={room.minX * 100}
            y1={single.at.z * 100}
            x2={single.at.x * 100}
            y2={single.at.z * 100}
            className={styles.planMeasure}
          />
          <text
            x={(room.minX * 100 + single.at.x * 100) / 2}
            y={single.at.z * 100 - 6 * px}
            className={styles.planMeasureText}
            style={text}
            textAnchor="middle"
          >
            {Math.round((single.at.x - room.minX) * 100)} cm
          </text>
          <line
            x1={single.at.x * 100}
            y1={room.minZ * 100}
            x2={single.at.x * 100}
            y2={single.at.z * 100}
            className={styles.planMeasure}
          />
          <text
            x={single.at.x * 100 + 6 * px}
            y={(room.minZ * 100 + single.at.z * 100) / 2}
            className={styles.planMeasureText}
            style={text}
          >
            {Math.round((single.at.z - room.minZ) * 100)} cm
          </text>
          {!single.item.locked && (
            <g
              transform={`translate(${single.at.x * 100} ${single.at.z * 100}) rotate(${-single.at.rotY})`}
            >
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={-(reachOf(single.at) + HANDLE_GAP_PX * px)}
                className={styles.planHandleLine}
              />
              <circle
                cx={0}
                cy={-(reachOf(single.at) + HANDLE_GAP_PX * px)}
                r={HANDLE_R_PX * px}
                className={styles.planHandle}
                onPointerDown={(e) => onHandleDown(e, single.item)}
              >
                <title>Drag to turn (15° steps; Shift: freely)</title>
              </circle>
            </g>
          )}
        </>
      )}

      {helpers.person && (
        <g
          transform={`translate(${room.centreX * 100 + 120} ${room.centreZ * 100 + 120})`}
          className={styles.planPerson}
        >
          <circle r={22} />
          <text y={22 + 14 * px} style={text} textAnchor="middle">
            Person · 1.70 m
          </text>
        </g>
      )}

      <SnapPreview layout={layout} sizes={sizes} selectedIds={selectedIds} px={px} />
    </svg>
  )
}

/**
 * While a free Object is over a pedestal's top, that pedestal is outlined; while it is against the
 * side of an item off the floor, that side is drawn (what it would attach to on release).
 */
function SnapPreview({
  layout,
  sizes,
  selectedIds,
  px,
}: {
  layout: FloorLayout
  sizes: FloorSizes
  selectedIds: string[]
  px: number
}) {
  const helpers = useSelector((state: RootState) => state.floor.helpers)
  if (!helpers.snapPedestals || selectedIds.length !== 1) return null
  const o = layout.items.find((i) => i.id === selectedIds[0])
  if (!o || o.kind !== 'object' || o.parentId) return null
  const exclude = new Set([o.id, ...descendantsOf(layout, o.id)])
  const places = placeMap(layout, sizes)
  const p = supportUnder(layout, sizes, o.room, o.x, o.z, exclude)
  if (p) {
    const points = planOutline(p, places.get(p.id)!)
      .map(([x, z]) => `${x},${z}`)
      .join(' ')
    return <polygon points={points} className={styles.planSnap} />
  }
  const side = sideAgainst(layout, sizes, o, o.x, o.z, SNAP_PX * px, exclude)
  if (!side) return null
  const f = faceFrame(places.get(side.parent.id)!, side.face)
  const half = f.across.clone().multiplyScalar(f.width / 2)
  return (
    <line
      x1={(f.centre.x - half.x) * 100}
      y1={(f.centre.z - half.z) * 100}
      x2={(f.centre.x + half.x) * 100}
      y2={(f.centre.z + half.z) * 100}
      className={styles.planSnapSide}
    />
  )
}

/** Ticks every 50 cm along the room's north and west walls, numbers every metre. */
function Rulers({ room, px }: { room: FloorRoom; px: number }) {
  const ticks: { x: number; label: boolean }[] = []
  for (let cm = 0; cm <= (room.maxX - room.minX) * 100; cm += 50)
    ticks.push({ x: cm, label: cm % 100 === 0 })
  const ticksZ: { z: number; label: boolean }[] = []
  for (let cm = 0; cm <= (room.maxZ - room.minZ) * 100; cm += 50)
    ticksZ.push({ z: cm, label: cm % 100 === 0 })
  const x0 = room.minX * 100
  const z0 = room.minZ * 100
  return (
    <g className={styles.planRuler} aria-hidden>
      {ticks.map(({ x, label }) => (
        <g key={`x${x}`}>
          <line x1={x0 + x} y1={z0 - 8 * px} x2={x0 + x} y2={z0 - (label ? 16 : 12) * px} />
          {label && (
            <text x={x0 + x} y={z0 - 19 * px} style={{ fontSize: 10 * px }} textAnchor="middle">
              {x / 100}
            </text>
          )}
        </g>
      ))}
      {ticksZ.map(({ z, label }) => (
        <g key={`z${z}`}>
          <line x1={x0 - 8 * px} y1={z0 + z} x2={x0 - (label ? 16 : 12) * px} y2={z0 + z} />
          {label && (
            <text
              x={x0 - 19 * px}
              y={z0 + z}
              style={{ fontSize: 10 * px }}
              textAnchor="end"
              dominantBaseline="central"
            >
              {z / 100}
            </text>
          )}
        </g>
      ))}
    </g>
  )
}
