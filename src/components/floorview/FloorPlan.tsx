'use client'

import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import { useSelector } from 'react-redux'
import c from 'classnames'

import type { FloorArtwork } from '@/lib/floor/floorArtworks'
import type { FloorItem, FloorLayout } from '@/lib/floor/floorLayout'
import { pedestalUnder, placeAll, rotateOffset, type Placed } from '@/lib/floor/floorPlacement'
import { insideOutline, pedestalOutline, pedestalTop } from '@/lib/floor/pedestals'
import type { RootState } from '@/redux/store'

import type { FloorEditor } from './useFloorEditor'
import type { FloorRoom } from './useFloorRooms'
import styles from './FloorView.module.scss'

/**
 * The plan (docs/objects O6, objects-floor-view-draft.dc.html): the room seen from above, in cm
 * (x right, z down: the room's world axes). Pedestals are their outline, Objects their footprint,
 * both turned as they stand. Click picks (Shift adds), drag moves (snapping to align and, on
 * release, onto pedestals; Alt never snaps), the handle turns (15° steps, Shift free).
 */
export const DRAG_TYPE = 'application/x-floor-add'

const MARGIN_CM = 80
const SNAP_PX = 8
const ROTATE_STEP = 15
/** On-screen sizes (px), turned into plan cm by `px`. */
const TEXT_PX = 11
const HANDLE_GAP_PX = 26
const HANDLE_R_PX = 7

type Props = {
  room: FloorRoom
  editor: FloorEditor
  artworks: Record<string, FloorArtwork>
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  /** A picked group member brings its group (Shift picks single items). */
  expand: (ids: string[]) => string[]
  /** Something dragged in from the add bar landed at (x, z) metres. */
  onDropAdd: (payload: string, x: number, z: number) => void
  zoom: number
  names: Record<string, string>
}

/** An Object's footprint (cm): its model's width × depth at its scale. */
export const footprintOf = (item: FloorItem, artworks: Record<string, FloorArtwork>) => {
  if (item.kind === 'pedestal') return { w: item.w, d: item.d }
  const b = artworks[item.artworkId]?.boundsCm
  return { w: (b?.w ?? 40) * item.scale, d: (b?.d ?? 40) * item.scale }
}

/**
 * An Object on a pedestal whose footprint reaches past the top (allowed; owner: an amber outline as
 * a warning). Checked in the pedestal's frame: the footprint's corners, turned and offset.
 */
const overhangs = (
  item: FloorItem,
  layout: FloorLayout,
  artworks: Record<string, FloorArtwork>,
) => {
  if (item.kind !== 'object' || !item.pedestalId) return false
  const p = layout.items.find((i) => i.id === item.pedestalId)
  if (!p || p.kind !== 'pedestal') return false
  const top = pedestalTop(p.shape, p.w, p.d, p.h).outline
  const { w, d } = footprintOf(item, artworks)
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].some(([x, z]) => {
    const [rx, rz] = rotateOffset(x, z, item.rotY)
    return !insideOutline(top, item.offsetX + rx, item.offsetZ + rz)
  })
}

export function FloorPlan({
  room,
  editor,
  artworks,
  selectedIds,
  onSelect,
  expand,
  onDropAdd,
  zoom,
  names,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const helpers = useSelector((state: RootState) => state.floor.helpers)
  const [guides, setGuides] = useState<{ x: number | null; z: number | null }>({ x: null, z: null })
  const editorRef = useRef(editor)
  editorRef.current = editor
  const helpersRef = useRef(helpers)
  helpersRef.current = helpers

  const layout: FloorLayout = editor.layout
  const placed = useMemo(
    () => placeAll(layout).filter(({ item }) => item.room === room.room),
    [layout, room.room],
  )
  const atById = useMemo(() => new Map(placed.map(({ item, at }) => [item.id, at])), [placed])

  // The view: the room and a margin, zoomed around its centre.
  const cmX0 = room.minX * 100 - MARGIN_CM
  const cmZ0 = room.minZ * 100 - MARGIN_CM
  const fullW = (room.maxX - room.minX) * 100 + MARGIN_CM * 2
  const fullH = (room.maxZ - room.minZ) * 100 + MARGIN_CM * 2
  const viewW = fullW / zoom
  const viewH = fullH / zoom
  const viewBox = `${cmX0 + (fullW - viewW) / 2} ${cmZ0 + (fullH - viewH) / 2} ${viewW} ${viewH}`

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

  // ── Moving ──
  const moveStart = useRef<{ x: number; z: number; lead: Placed; leadId: string } | null>(null)

  const onItemDown = (event: PointerEvent, item: FloorItem) => {
    event.stopPropagation()
    if (event.button !== 0) return
    const already = selectedIds.includes(item.id)
    const ids = event.shiftKey
      ? already
        ? selectedIds.filter((id) => id !== item.id)
        : [...selectedIds, item.id]
      : already
        ? selectedIds
        : expand([item.id])
    onSelect(ids)
    if (event.shiftKey || item.locked) return
    const lead = atById.get(item.id)
    if (!lead) return
    const p = toPlan(event.clientX, event.clientY)
    moveStart.current = { x: p.x, z: p.z, lead, leadId: item.id }
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
        const lead = editorRef.current.layout.items.find((i) => i.id === start.leadId)
        const half = lead ? footprintOf(lead, artworks) : { w: 0, d: 0 }
        const xs = [
          room.centreX * 100,
          room.minX * 100 + half.w / 2,
          room.maxX * 100 - half.w / 2,
          ...placed
            .filter(({ item }) => !selectedIds.includes(item.id))
            .map(({ at }) => at.x * 100),
        ]
        const zs = [
          room.centreZ * 100,
          room.minZ * 100 + half.d / 2,
          room.maxZ * 100 - half.d / 2,
          ...placed
            .filter(({ item }) => !selectedIds.includes(item.id))
            .map(({ at }) => at.z * 100),
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
      editorRef.current.dragTo(dx / 100, dz / 100)
    }
    const onUp = (event: globalThis.PointerEvent) => {
      if (!moveStart.current) return
      moveStart.current = null
      setGuides({ x: null, z: null })
      editorRef.current.endDrag(helpersRef.current.snapPedestals && !event.altKey)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // toPlan reads the svg ref; the rest comes through refs.
  }, [placed, selectedIds, room, artworks])

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
      editorRef.current.endDrag(false)
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
      onPointerDown={() => onSelect([])}
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

      {/* Pedestals first, the Objects over them. */}
      {[...placed]
        .sort((a, b) => (a.item.kind === b.item.kind ? 0 : a.item.kind === 'pedestal' ? -1 : 1))
        .map(({ item, at }) => {
          const selected = selectedIds.includes(item.id)
          const fp = footprintOf(item, artworks)
          const points =
            item.kind === 'pedestal'
              ? pedestalOutline(item.shape, item.w, item.d)
                  .map(([x, z]) => `${x},${z}`)
                  .join(' ')
              : `${-fp.w / 2},${-fp.d / 2} ${fp.w / 2},${-fp.d / 2} ${fp.w / 2},${fp.d / 2} ${-fp.w / 2},${fp.d / 2}`
          return (
            <g
              key={item.id}
              transform={`translate(${at.x * 100} ${at.z * 100}) rotate(${-at.rotY})`}
              className={c(
                styles.planItem,
                selected && styles.planSelected,
                overhangs(item, layout, artworks) && styles.planOverhang,
              )}
              onPointerDown={(e) => onItemDown(e, item)}
            >
              <polygon
                points={points}
                className={item.kind === 'pedestal' ? styles.planPedestal : styles.planObject}
              />
              {item.kind === 'object' && (
                // The front: a short line toward the model's +z.
                <line x1={0} y1={fp.d / 2 - 4} x2={0} y2={fp.d / 2} className={styles.planFront} />
              )}
            </g>
          )
        })}

      {/* Names, upright whatever the turn. */}
      {placed.map(({ item, at }) => (
        <text
          key={`n-${item.id}`}
          x={at.x * 100}
          y={at.z * 100}
          className={styles.planTag}
          style={text}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {names[item.id]}
        </text>
      ))}

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
                y2={-(footprintOf(single.item, artworks).d / 2 + HANDLE_GAP_PX * px)}
                className={styles.planHandleLine}
              />
              <circle
                cx={0}
                cy={-(footprintOf(single.item, artworks).d / 2 + HANDLE_GAP_PX * px)}
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

      <SnapPreview layout={layout} room={room.room} selectedIds={selectedIds} />
    </svg>
  )
}

/** While an Object is over a pedestal's top, that pedestal is outlined (what it would snap to). */
function SnapPreview({
  layout,
  room,
  selectedIds,
}: {
  layout: FloorLayout
  room: number
  selectedIds: string[]
}) {
  const helpers = useSelector((state: RootState) => state.floor.helpers)
  if (!helpers.snapPedestals || selectedIds.length !== 1) return null
  const o = layout.items.find((i) => i.id === selectedIds[0])
  if (!o || o.kind !== 'object' || o.pedestalId) return null
  const p = pedestalUnder(layout, room, o.x, o.z)
  if (!p) return null
  const points = pedestalOutline(p.shape, p.w, p.d)
    .map(([x, z]) => `${x},${z}`)
    .join(' ')
  return (
    <polygon
      points={points}
      transform={`translate(${p.x * 100} ${p.z * 100}) rotate(${-p.rotY})`}
      className={styles.planSnap}
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
