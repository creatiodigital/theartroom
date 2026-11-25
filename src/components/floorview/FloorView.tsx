'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  BookOpen,
  CornersOut,
  Cube,
  Magnet,
  Minus,
  Person,
  Plus,
  Ruler,
  X,
} from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'
import { SegmentStrip } from '@/components/wallview/chrome'
import type { FloorArtwork } from '@/lib/floor/floorArtworks'
import {
  nextName,
  type FloorItem,
  type FloorObject,
  type FloorPedestal,
} from '@/lib/floor/floorLayout'
import { detachItem, dropItem, removeItems } from '@/lib/floor/floorPlacement'
import { PEDESTAL_DEFAULT_LOOK, pedestalShape } from '@/lib/floor/pedestals'
import { addFloorArtworks } from '@/redux/slices/exhibitionSlice'
import { hidePlaceholders, showPlaceholders } from '@/redux/slices/sceneSlice'
import {
  hideFloorView,
  selectFloorItems,
  setFloorHelper,
  setFloorRoom,
  type FloorHelpers,
} from '@/redux/slices/floorSlice'
import type { RootState } from '@/redux/store'

import { floorBridge } from './floorBridge'
import { FloorInspector } from './FloorInspector'
import { DRAG_TYPE, FloorPlan, PLAN_ZOOM } from './FloorPlan'
import { useFloorEditor } from './useFloorEditor'
import { useFloorRooms } from './useFloorRooms'

// The wall editor's headings (eyebrow, title, captions), so both editors read the same.
import panelGroup from '@/components/wallview/chrome/PanelGroup.module.scss'
import wallPanel from '@/components/wallview/LeftPanel/LeftPanel.module.scss'
import styles from './FloorView.module.scss'

/**
 * The Floor view (docs/objects O6, objects-floor-view-draft.dc.html): the left panel (the room,
 * Cancel / Save / Save & close, undo, zoom, helpers, what stands on this floor), the plan, the
 * live 3D (the editor's own canvas, placed beside the plan by `FloorFrame`), the add bar (Objects
 * from the library, pedestals) and the picked item's panel. Everything is marked as a panel
 * overlay, so the room's camera ignores presses and wheels over it.
 */
/** Free in the room at (x, z), on the floor, unturned. */
const FREE_AT = (room: number, x: number, z: number) => ({
  room,
  x,
  z,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  lift: 0,
  parentId: null,
  face: 'top' as const,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  locked: false,
})

const newId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

type LibraryArtwork = FloorArtwork & { ready: boolean }

export function FloorView() {
  const dispatch = useDispatch()

  // The live 3D is a helper for placing Objects, not for walls: no wall placeholders while the
  // Floor plan is open (owner, 2026-11-25); they come back as they were when it closes.
  const placeholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const hadPlaceholders = useRef(placeholdersShown)
  useEffect(() => {
    const had = hadPlaceholders.current
    if (had) dispatch(hidePlaceholders())
    return () => {
      if (had) dispatch(showPlaceholders())
    }
  }, [dispatch])
  const editor = useFloorEditor()
  const { rooms } = useFloorRooms()
  const roomIndex = useSelector((state: RootState) => state.floor.room)
  const selectedIds = useSelector((state: RootState) => state.floor.selectedIds)
  const helpers = useSelector((state: RootState) => state.floor.helpers)
  // Over the live 3D the arrows walk the room (MainCamera), so they never also move the pick.
  const pointerOnRoom = useSelector((state: RootState) => state.floor.pointerOnRoom)
  const pointerOnRoomRef = useRef(pointerOnRoom)
  useEffect(() => {
    pointerOnRoomRef.current = pointerOnRoom
  }, [pointerOnRoom])
  const storedArtworks = useSelector((state: RootState) => state.exhibition.floorArtworks)
  const artworks = useMemo(() => storedArtworks ?? {}, [storedArtworks])
  const ownerId = useSelector((state: RootState) => state.exhibition.userId)
  const room = rooms[Math.min(roomIndex, rooms.length - 1)]
  const [zoom, setZoom] = useState(1)
  // Where the plan is centred once moved (pinch, scroll, drag): per room; Fit goes back to the room.
  const [planView, setPlanView] = useState<{ room: number; x: number; z: number } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [library, setLibrary] = useState<LibraryArtwork[] | null>(null)
  const [filter, setFilter] = useState<'all' | 'object' | 'pedestal'>('all')
  const { layout } = editor

  const select = useCallback((ids: string[]) => dispatch(selectFloorItems(ids)), [dispatch])
  // Picked in the list ("On this floor"): the plan keeps that pick until it changes elsewhere
  // (owner, 2026-11-25: "if I select an object on the left, lock it, don't allow selecting
  // another one on the map").
  const [listPick, setListPick] = useState(false)
  const selectOnPlan = useCallback(
    (ids: string[]) => {
      if (ids.join() !== selectedIds.join()) setListPick(false)
      select(ids)
    },
    [select, selectedIds],
  )

  // Names: an Object's title, a pedestal's own name.
  const names = useMemo(() => {
    const out: Record<string, string> = {}
    for (const i of layout.items) {
      out[i.id] = i.kind === 'pedestal' ? i.name : (artworks[i.artworkId]?.title ?? 'Object')
    }
    return out
  }, [layout.items, artworks])

  // Clicking one member of a group picks the group (Shift picks single items).
  const expand = useCallback(
    (ids: string[]) => {
      if (ids.length !== 1) return ids
      const g = layout.groups.find((grp) => grp.memberIds.includes(ids[0]))
      return g ? g.memberIds : ids
    },
    [layout.groups],
  )

  // ── The library: the artist's Objects (only those with a ready 3D model can go on the floor) ──
  useEffect(() => {
    if (!libraryOpen || library || !ownerId) return
    fetch(`/api/artworks?userId=${ownerId}&artworkType=object`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Array<Record<string, unknown>>) =>
        setLibrary(
          rows.map((r) => ({
            id: r.id as string,
            slug: r.slug as string,
            title: (r.title as string) || 'Object',
            author: (r.author as string) || '',
            imageUrl: (r.imageUrl as string) || null,
            modelUrl: (r.modelUrl as string) || '',
            boundsCm: (r.modelBoundsCm as FloorArtwork['boundsCm']) ?? null,
            ready: r.modelStatus === 'ready' && !!r.modelUrl,
          })),
        ),
      )
      .catch(() => setLibrary([]))
  }, [libraryOpen, library, ownerId])

  // An Object is a unique piece: once on this exhibition's floor, in any room (owner, 2026-11-25).
  // Pedestals repeat freely.
  const placedObjects = useMemo(
    () =>
      new Map(
        layout.items.flatMap((i) => (i.kind === 'object' ? [[i.artworkId, i] as const] : [])),
      ),
    [layout.items],
  )

  // ── Adding ──
  const addObject = useCallback(
    (artwork: FloorArtwork, x: number, z: number) => {
      if (!room) return
      const already = placedObjects.get(artwork.id)
      if (already) {
        // Already on the floor: pick it instead (in its room).
        if (already.room !== room.room) dispatch(setFloorRoom(already.room))
        select([already.id])
        return
      }
      dispatch(addFloorArtworks([artwork]))
      const o: FloorObject = {
        kind: 'object',
        id: newId('o'),
        artworkId: artwork.id,
        ...FREE_AT(room.room, x, z),
        scale: 1,
        castShadow: true,
      }
      const placed = dropItem(
        layout,
        o,
        x,
        z,
        { ...editor.sizes, [artwork.id]: artwork.boundsCm },
        { snap: helpers.snapPedestals, centre: true },
      )
      editor.commit({ ...layout, items: [...layout.items, placed] })
      select([placed.id])
    },
    [dispatch, editor, helpers.snapPedestals, layout, placedObjects, room, select],
  )

  const nextPedestalName = useCallback(
    (shape: string = 'box') =>
      nextName(
        shape === 'plank' ? 'Plank' : 'Pedestal',
        layout.items.flatMap((i) => (i.kind === 'pedestal' ? [i.name] : [])),
      ),
    [layout.items],
  )

  const addPedestal = useCallback(
    (x: number, z: number, from?: FloorPedestal) => {
      if (!room) return
      const shape = pedestalShape('box')
      // A copy stands free beside the original (whatever that is attached to): (x, z) are given
      // from the original's stored spot, which goes stale once what it is on moves.
      const free = from && detachItem(layout, from, editor.sizes)
      const p: FloorPedestal =
        from && free
          ? {
              ...free,
              id: newId('p'),
              name: nextPedestalName(from.shape),
              x: free.x + (x - from.x),
              z: free.z + (z - from.z),
              locked: false,
            }
          : {
              kind: 'pedestal',
              id: newId('p'),
              name: nextPedestalName(),
              ...FREE_AT(room.room, x, z),
              shape: shape.id,
              ...shape.defaults,
              ...PEDESTAL_DEFAULT_LOOK,
            }
      editor.commit({ ...layout, items: [...layout.items, p] })
      select([p.id])
    },
    [editor, layout, nextPedestalName, room, select],
  )

  const onDropAdd = useCallback(
    (payload: string, x: number, z: number) => {
      try {
        const data = JSON.parse(payload) as { kind: string; artwork?: FloorArtwork }
        if (data.kind === 'pedestal') addPedestal(x, z)
        if (data.kind === 'object' && data.artwork) addObject(data.artwork, x, z)
      } catch {
        /* not ours */
      }
    },
    [addObject, addPedestal],
  )

  // ── Save / close ──
  const save = async (close: boolean) => {
    setMessage(null)
    const error = await editor.save()
    if (error) {
      setMessage(error)
      return
    }
    if (close) dispatch(hideFloorView())
    else setMessage('Saved')
  }
  const cancel = () => {
    editor.revert()
    dispatch(hideFloorView())
  }

  // The live 3D drags through the same editor (floorBridge), always its latest (as editorRef):
  // set on every render while the view is open, cleared when it closes.
  floorBridge.editor = editor
  floorBridge.expand = expand
  floorBridge.lockPick = listPick && selectedIds.length > 0
  useEffect(
    () => () => {
      floorBridge.editor = null
      floorBridge.expand = (ids) => ids
      floorBridge.lockPick = false
    },
    [],
  )

  // The library closes on its ×, Escape, or a press anywhere outside it.
  const libraryRef = useRef<HTMLDivElement>(null)
  const libraryOpenRef = useRef(libraryOpen)
  useEffect(() => {
    libraryOpenRef.current = libraryOpen
    if (!libraryOpen) return
    const onDown = (event: PointerEvent) => {
      if (!libraryRef.current?.contains(event.target as Node)) setLibraryOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [libraryOpen])

  // ── Keys ──
  const editorRef = useRef(editor)
  editorRef.current = editor
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const ed = editorRef.current
      const mod = event.metaKey || event.ctrlKey
      const ids = new Set(selectedIds)
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) ed.redo()
        else ed.undo()
        return
      }
      if (mod && event.key.toLowerCase() === 'g') {
        event.preventDefault()
        if (event.shiftKey) {
          ed.commit({
            ...ed.layout,
            groups: ed.layout.groups.filter((g) => !g.memberIds.some((m) => ids.has(m))),
          })
        } else if (ids.size >= 2) {
          ed.commit({
            ...ed.layout,
            groups: [
              ...ed.layout.groups,
              { id: newId('g'), name: `Group ${ed.layout.groups.length + 1}`, memberIds: [...ids] },
            ],
          })
        }
        return
      }
      if (mod && event.key.toLowerCase() === 'd' && selectedIds.length === 1) {
        const p = ed.layout.items.find((i) => i.id === selectedIds[0])
        if (p?.kind === 'pedestal') {
          event.preventDefault()
          addPedestal(p.x + 0.6, p.z, p)
        }
        return
      }
      if (event.key === 'Escape') {
        // The library first, if it is open.
        if (libraryOpenRef.current) setLibraryOpen(false)
        else select([])
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && ids.size) {
        event.preventDefault()
        // What was attached to them stays where it is.
        ed.commit(removeItems(ed.layout, ids, ed.sizes))
        select([])
        return
      }
      const step = event.shiftKey ? 0.1 : 0.01
      const move: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      if (move[event.key] && ids.size && !pointerOnRoomRef.current) {
        event.preventDefault()
        const [dx, dz] = move[event.key]
        // Free: across the floor. On a top or bottom: in its parent's frame (as O6). On a side:
        // left / right across the face, up / down up it.
        ed.update((all) =>
          all.map((i: FloorItem) =>
            !ids.has(i.id) || i.locked
              ? i
              : !i.parentId
                ? { ...i, x: i.x + dx, z: i.z + dz }
                : i.face === 'top' || i.face === 'bottom'
                  ? { ...i, offsetX: i.offsetX + dx * 100, offsetZ: i.offsetZ + dz * 100 }
                  : { ...i, offsetX: i.offsetX + dx * 100, offsetY: i.offsetY - dz * 100 },
          ),
        )
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, select, addPedestal])

  if (!room) return null

  const roomW = Math.round((room.maxX - room.minX) * 100)
  const roomD = Math.round((room.maxZ - room.minZ) * 100)
  const inRoom = layout.items.filter((i) => i.room === room.room)
  const listed = inRoom.filter((i) => filter === 'all' || i.kind === filter)
  // What stands free (pedestals first, then Objects), each followed by what is attached to it, at
  // any depth. A filter shows a flat list of its kind.
  const rows: { item: FloorItem; child: boolean }[] = []
  if (filter === 'all') {
    const ids = new Set(inRoom.map((i) => i.id))
    const walk = (item: FloorItem, depth: number) => {
      rows.push({ item, child: depth > 0 })
      for (const c of inRoom.filter((i) => i.parentId === item.id)) walk(c, depth + 1)
    }
    const roots = inRoom.filter((i) => !i.parentId || !ids.has(i.parentId))
    for (const r of [
      ...roots.filter((i) => i.kind === 'pedestal'),
      ...roots.filter((i) => i.kind === 'object'),
    ])
      walk(r, 0)
  } else {
    for (const i of listed) rows.push({ item: i, child: false })
  }

  const helperRows: { key: keyof FloorHelpers; label: string; sub: string; icon: ReactNode }[] = [
    {
      key: 'rulers',
      label: 'Rulers & guides',
      sub: 'Metres along the walls',
      icon: <Ruler size={16} aria-hidden />,
    },
    {
      key: 'snapAlign',
      label: 'Snap to align',
      sub: 'Snap to centres and walls',
      icon: <Magnet size={16} aria-hidden />,
    },
    {
      key: 'snapPedestals',
      label: 'Snap to pedestals',
      sub: 'Objects stick to a pedestal’s top or a raised side',
      icon: <Magnet size={16} aria-hidden />,
    },
    {
      key: 'person',
      label: 'Person for scale',
      sub: 'A 1.70 m figure in the room',
      icon: <Person size={16} aria-hidden />,
    },
  ]

  const centre = { x: room.centreX, z: room.centreZ }

  return (
    <>
      <aside className={styles.left} aria-label="Floor options" data-panel-overlay>
        <header className={styles.leftHead}>
          <div className={styles.leftTitle}>
            <span className={wallPanel.eyebrow}>Editing floor</span>
            {rooms.length > 1 ? (
              <select
                className={styles.roomSelect}
                value={room.room}
                onChange={(e) => dispatch(setFloorRoom(Number(e.target.value)))}
                aria-label="Room"
              >
                {rooms.map((r) => (
                  <option key={r.room} value={r.room}>
                    Room {r.room + 1} · {Math.round((r.maxX - r.minX) * 100)} ×{' '}
                    {Math.round((r.maxZ - r.minZ) * 100)} cm
                  </option>
                ))}
              </select>
            ) : (
              <h1 className={wallPanel.title}>
                Room {room.room + 1} · {roomW} × {roomD} cm
              </h1>
            )}
          </div>
          <div className={styles.saveRow}>
            <Button variant="secondary" size="small" font="dashboard" onClick={cancel}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="small"
              font="dashboard"
              disabled={editor.saving}
              onClick={() => save(false)}
            >
              Save
            </Button>
            <Button
              variant="primary"
              size="small"
              font="dashboard"
              disabled={editor.saving}
              onClick={() => save(true)}
            >
              {editor.saving ? 'Saving…' : 'Save & close'}
            </Button>
          </div>
          {(editor.dirty || message) && (
            <span className={styles.status} role="status">
              {message ?? 'Unsaved changes'}
            </span>
          )}
        </header>

        <div className={styles.toolbar}>
          <Button
            variant="bare"
            className={styles.iconButton}
            aria-label="Undo"
            disabled={!editor.canUndo}
            onClick={editor.undo}
          >
            <ArrowCounterClockwise size={17} aria-hidden />
          </Button>
          <Button
            variant="bare"
            className={styles.iconButton}
            aria-label="Redo"
            disabled={!editor.canRedo}
            onClick={editor.redo}
          >
            <ArrowClockwise size={17} aria-hidden />
          </Button>
          <span aria-hidden className={styles.toolbarGap} />
          <Button
            variant="bare"
            className={styles.iconButton}
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(PLAN_ZOOM.min, z / 1.25))}
          >
            <Minus size={15} aria-hidden />
          </Button>
          <span className={styles.zoom}>{Math.round(zoom * 100)}%</span>
          <Button
            variant="bare"
            className={styles.iconButton}
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(PLAN_ZOOM.max, z * 1.25))}
          >
            <Plus size={15} aria-hidden />
          </Button>
          <Button
            variant="secondary"
            size="small"
            font="dashboard"
            onClick={() => {
              setZoom(1)
              setPlanView(null)
            }}
          >
            <CornersOut size={14} aria-hidden />
            Fit
          </Button>
        </div>

        <section className={styles.helpers} aria-labelledby="floor-helpers">
          <h2 id="floor-helpers" className={panelGroup.title}>
            Helpers
          </h2>
          {helperRows.map((h) => (
            <label key={h.key} className={styles.helperRow}>
              <span
                className={c(styles.helperTile, helpers[h.key] && styles.helperTileOn)}
                aria-hidden
              >
                {h.icon}
              </span>
              <span className={styles.helperText}>
                <span>{h.label}</span>
                <span className={styles.hint}>{h.sub}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={helpers[h.key]}
                onChange={(e) => dispatch(setFloorHelper({ key: h.key, on: e.target.checked }))}
              />
            </label>
          ))}
        </section>

        <section className={styles.list} aria-labelledby="floor-items">
          <div className={styles.listHead}>
            <h2 id="floor-items" className={panelGroup.title}>
              On this floor
            </h2>
            <span className={styles.hint}>
              {inRoom.length} item{inRoom.length === 1 ? '' : 's'}
            </span>
          </div>
          {/* The wall editor's own Show strip (consistency, owner 2026-11-25). */}
          <SegmentStrip
            label="Show"
            segments={(['all', 'object', 'pedestal'] as const).map((f) => ({
              key: f,
              label: f === 'all' ? 'All' : f === 'object' ? 'Objects' : 'Pedestals',
              pressed: filter === f,
              onClick: () => setFilter(f),
            }))}
          />
          <ul className={styles.items}>
            {rows.map(({ item, child }) => (
              <li key={item.id}>
                <Button
                  variant="bare"
                  className={c(
                    styles.itemRow,
                    child && styles.itemChild,
                    selectedIds.includes(item.id) && styles.itemOn,
                  )}
                  aria-current={selectedIds.includes(item.id)}
                  onClick={() => {
                    select(expand([item.id]))
                    setListPick(true)
                  }}
                >
                  <span className={styles.itemIcon} aria-hidden>
                    <Cube size={14} weight={item.kind === 'pedestal' ? 'regular' : 'fill'} />
                  </span>
                  <span className={styles.itemName}>{names[item.id]}</span>
                  <span className={styles.itemKind}>
                    {item.kind === 'pedestal'
                      ? pedestalShape(item.shape).id === 'plank'
                        ? 'Plank'
                        : 'Pedestal'
                      : item.lift > 0 && !item.parentId
                        ? `Object · ↑ ${Math.round(item.lift)}`
                        : 'Object'}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          {inRoom.length === 0 && (
            <p className={styles.empty}>
              Nothing on this floor yet. Add an Object from your library, or a pedestal.
            </p>
          )}
        </section>
      </aside>

      <section
        className={styles.plan}
        aria-label="Plan, seen from above"
        data-panel-overlay
        data-floor-plan
      >
        <span className={styles.chip}>
          <b>Plan</b> seen from above · pinch to zoom, drag the background to move
        </span>
        <FloorPlan
          room={room}
          editor={editor}
          selectedIds={selectedIds}
          onSelect={selectOnPlan}
          expand={expand}
          onDropAdd={onDropAdd}
          zoom={zoom}
          lockPick={listPick}
          centre={planView && planView.room === room.room ? planView : null}
          onView={(z, c) => {
            setZoom(z)
            setPlanView({ room: room.room, ...c })
          }}
        />
      </section>

      <span className={styles.threeChip} aria-hidden>
        <b>3D</b> live
      </span>

      <nav className={styles.addBar} aria-label="Add to the floor" data-panel-overlay>
        <div className={styles.libraryWrap} ref={libraryRef}>
          <Button
            variant="bare"
            className={styles.addButton}
            aria-expanded={libraryOpen}
            onClick={() => setLibraryOpen((o) => !o)}
          >
            <BookOpen size={20} aria-hidden />
            From library
          </Button>
          {libraryOpen && (
            <div className={styles.library} role="dialog" aria-label="Your Objects">
              <div className={styles.libraryHead}>
                <h2 className={panelGroup.title}>Your Objects</h2>
                <Button
                  variant="bare"
                  className={styles.libraryClose}
                  aria-label="Close your Objects"
                  onClick={() => setLibraryOpen(false)}
                >
                  <X size={16} aria-hidden />
                </Button>
              </div>
              {library === null ? (
                <p className={styles.hint}>Loading your Objects…</p>
              ) : library.length === 0 ? (
                <p className={styles.hint}>
                  No Objects yet. Add one in your Artwork library; once its 3D model is in, it can
                  go on the floor.
                </p>
              ) : (
                <ul>
                  {library.map((a) => {
                    const placed = placedObjects.has(a.id)
                    const addable = a.ready && !placed
                    return (
                      <li key={a.id}>
                        <Button
                          variant="bare"
                          className={styles.libraryRow}
                          disabled={!addable}
                          draggable={addable}
                          onDragStart={(e) =>
                            e.dataTransfer.setData(
                              DRAG_TYPE,
                              JSON.stringify({ kind: 'object', artwork: a }),
                            )
                          }
                          onClick={() => {
                            addObject(a, centre.x, centre.z)
                            setLibraryOpen(false)
                          }}
                          title={
                            addable
                              ? 'Click to add it in the middle of the room, or drag it onto the plan'
                              : undefined
                          }
                        >
                          {a.imageUrl ? (
                            <img src={a.imageUrl} alt="" className={styles.libraryThumb} />
                          ) : (
                            <span className={styles.libraryThumb} />
                          )}
                          <span className={styles.libraryText}>
                            <b>{a.title}</b>
                            <span className={styles.hint}>
                              {placed
                                ? 'Already on the floor'
                                : a.ready
                                  ? a.boundsCm
                                    ? `${Math.round(a.boundsCm.h)} × ${Math.round(a.boundsCm.w)} × ${Math.round(a.boundsCm.d)} cm`
                                    : '3D model ready'
                                  : 'No 3D model yet'}
                            </span>
                          </span>
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
        <span aria-hidden className={styles.addGap} />
        <Button
          variant="bare"
          className={styles.addButton}
          draggable
          onDragStart={(e) =>
            e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind: 'pedestal' }))
          }
          onClick={() => addPedestal(centre.x, centre.z)}
          title="Add a pedestal: click to add it in the middle of the room, or drag it onto the plan"
        >
          <Cube size={20} aria-hidden />
          Pedestal
        </Button>
        <span className={styles.addHint}>
          Click to add in the middle of the room, or drag onto the plan.
        </span>
      </nav>

      <div className={styles.right} data-panel-overlay>
        <FloorInspector
          editor={editor}
          room={room}
          artworks={artworks}
          selectedIds={selectedIds}
          names={names}
          onSelect={select}
          onDuplicate={(p) => addPedestal(p.x + 0.6, p.z, p)}
        />
      </div>
    </>
  )
}
