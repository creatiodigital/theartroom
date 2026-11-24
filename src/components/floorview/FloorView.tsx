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
} from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'
import type { FloorArtwork } from '@/lib/floor/floorArtworks'
import { type FloorItem, type FloorObject, type FloorPedestal } from '@/lib/floor/floorLayout'
import { detachObject, dropObject } from '@/lib/floor/floorPlacement'
import { PEDESTAL_DEFAULT_LOOK, pedestalShape } from '@/lib/floor/pedestals'
import { addFloorArtworks } from '@/redux/slices/exhibitionSlice'
import {
  hideFloorView,
  selectFloorItems,
  setFloorHelper,
  setFloorRoom,
  type FloorHelpers,
} from '@/redux/slices/floorSlice'
import type { RootState } from '@/redux/store'

import { FloorInspector } from './FloorInspector'
import { DRAG_TYPE, FloorPlan } from './FloorPlan'
import { useFloorEditor } from './useFloorEditor'
import { useFloorRooms } from './useFloorRooms'
import styles from './FloorView.module.scss'

/**
 * The Floor view (docs/objects O6, objects-floor-view-draft.dc.html): the left panel (the room,
 * Cancel / Save / Save & close, undo, zoom, helpers, what stands on this floor), the plan, the
 * live 3D (the editor's own canvas, placed beside the plan by `FloorFrame`), the add bar (Objects
 * from the library, pedestals) and the picked item's panel. Everything is marked as a panel
 * overlay, so the room's camera ignores presses and wheels over it.
 */
const newId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

type LibraryArtwork = FloorArtwork & { ready: boolean; status: string }

export function FloorView() {
  const dispatch = useDispatch()
  const editor = useFloorEditor()
  const { rooms } = useFloorRooms()
  const roomIndex = useSelector((state: RootState) => state.floor.room)
  const selectedIds = useSelector((state: RootState) => state.floor.selectedIds)
  const helpers = useSelector((state: RootState) => state.floor.helpers)
  const storedArtworks = useSelector((state: RootState) => state.exhibition.floorArtworks)
  const artworks = useMemo(() => storedArtworks ?? {}, [storedArtworks])
  const ownerId = useSelector((state: RootState) => state.exhibition.userId)
  const room = rooms[Math.min(roomIndex, rooms.length - 1)]
  const [zoom, setZoom] = useState(1)
  const [message, setMessage] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [library, setLibrary] = useState<LibraryArtwork[] | null>(null)
  const [filter, setFilter] = useState<'all' | 'object' | 'pedestal'>('all')
  const { layout } = editor

  const select = useCallback((ids: string[]) => dispatch(selectFloorItems(ids)), [dispatch])

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
            status: r.modelStatus as string,
          })),
        ),
      )
      .catch(() => setLibrary([]))
  }, [libraryOpen, library, ownerId])

  // ── Adding ──
  const addObject = useCallback(
    (artwork: FloorArtwork, x: number, z: number) => {
      if (!room) return
      dispatch(addFloorArtworks([artwork]))
      const o: FloorObject = {
        kind: 'object',
        id: newId('o'),
        artworkId: artwork.id,
        room: room.room,
        x,
        z,
        rotY: 0,
        scale: 1,
        lift: 0,
        castShadow: true,
        pedestalId: null,
        offsetX: 0,
        offsetZ: 0,
        locked: false,
      }
      const placed = dropObject(layout, o, x, z, { snap: helpers.snapPedestals, centre: true })
      editor.commit({ ...layout, items: [...layout.items, placed] })
      select([placed.id])
    },
    [dispatch, editor, helpers.snapPedestals, layout, room, select],
  )

  const nextPedestalName = useCallback(() => {
    const used = layout.items
      .filter((i): i is FloorPedestal => i.kind === 'pedestal')
      .map((p) => Number(/(\d+)$/.exec(p.name)?.[1] ?? 0))
    return `Pedestal ${(used.length ? Math.max(...used) : 0) + 1}`
  }, [layout.items])

  const addPedestal = useCallback(
    (x: number, z: number, from?: FloorPedestal) => {
      if (!room) return
      const shape = pedestalShape('box')
      const p: FloorPedestal = from
        ? { ...from, id: newId('p'), name: nextPedestalName(), x, z, locked: false }
        : {
            kind: 'pedestal',
            id: newId('p'),
            name: nextPedestalName(),
            room: room.room,
            x,
            z,
            rotY: 0,
            lift: 0,
            shape: shape.id,
            ...shape.defaults,
            ...PEDESTAL_DEFAULT_LOOK,
            locked: false,
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
        select([])
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && ids.size) {
        event.preventDefault()
        ed.update((all) =>
          all
            .filter((i) => !ids.has(i.id))
            .map((i) =>
              i.kind === 'object' && i.pedestalId && ids.has(i.pedestalId)
                ? detachObject(ed.layout, i)
                : i,
            ),
        )
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
      if (move[event.key] && ids.size) {
        event.preventDefault()
        const [dx, dz] = move[event.key]
        ed.update((all) =>
          all.map((i: FloorItem) =>
            ids.has(i.id) && !i.locked && !(i.kind === 'object' && i.pedestalId)
              ? { ...i, x: i.x + dx, z: i.z + dz }
              : i.kind === 'object' && i.pedestalId && ids.has(i.id) && !i.locked
                ? { ...i, offsetX: i.offsetX + dx * 100, offsetZ: i.offsetZ + dz * 100 }
                : i,
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
  // Pedestals, each followed by its Objects; then the free Objects.
  const rows: { item: FloorItem; child: boolean }[] = []
  for (const p of listed.filter((i) => i.kind === 'pedestal')) {
    rows.push({ item: p, child: false })
    for (const o of inRoom.filter(
      (i) => i.kind === 'object' && i.pedestalId === p.id && filter !== 'pedestal',
    )) {
      rows.push({ item: o, child: true })
    }
  }
  for (const o of listed.filter(
    (i) => i.kind === 'object' && !(i.pedestalId && inRoom.some((p) => p.id === i.pedestalId)),
  )) {
    rows.push({ item: o, child: false })
  }
  if (filter === 'object') {
    rows.length = 0
    for (const o of listed) rows.push({ item: o, child: false })
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
      sub: 'Objects stick to a pedestal’s top',
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
            <span className={styles.cap}>Editing floor</span>
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
              <h1 className={styles.roomTitle}>
                Room {room.room + 1} · {roomW} × {roomD} cm
              </h1>
            )}
          </div>
          <div className={styles.saveRow}>
            <Button variant="bare" className={styles.btn} onClick={cancel}>
              Cancel
            </Button>
            <Button
              variant="bare"
              className={styles.btn}
              disabled={editor.saving}
              onClick={() => save(false)}
            >
              Save
            </Button>
            <Button
              variant="bare"
              className={c(styles.btn, styles.dark)}
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
            onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))}
          >
            <Minus size={15} aria-hidden />
          </Button>
          <span className={styles.zoom}>{Math.round(zoom * 100)}%</span>
          <Button
            variant="bare"
            className={styles.iconButton}
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(8, z * 1.25))}
          >
            <Plus size={15} aria-hidden />
          </Button>
          <Button variant="bare" className={styles.btn} onClick={() => setZoom(1)}>
            <CornersOut size={14} aria-hidden />
            Fit
          </Button>
        </div>

        <section className={styles.helpers} aria-labelledby="floor-helpers">
          <h2 id="floor-helpers" className={styles.cap}>
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
            <h2 id="floor-items" className={styles.cap}>
              On this floor
            </h2>
            <span className={styles.hint}>
              {inRoom.length} item{inRoom.length === 1 ? '' : 's'}
            </span>
          </div>
          <div role="group" aria-label="Show" className={styles.filter}>
            {(['all', 'object', 'pedestal'] as const).map((f) => (
              <Button
                key={f}
                variant="bare"
                className={c(styles.filterButton, filter === f && styles.filterOn)}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'object' ? 'Objects' : 'Pedestals'}
              </Button>
            ))}
          </div>
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
                  onClick={() => select(expand([item.id]))}
                >
                  <span className={styles.itemIcon} aria-hidden>
                    <Cube size={14} weight={item.kind === 'pedestal' ? 'regular' : 'fill'} />
                  </span>
                  <span className={styles.itemName}>{names[item.id]}</span>
                  <span className={styles.itemKind}>
                    {item.kind === 'pedestal'
                      ? 'Pedestal'
                      : item.lift > 0 && !item.pedestalId
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
          <b>Plan</b> seen from above
        </span>
        <FloorPlan
          room={room}
          editor={editor}
          artworks={artworks}
          selectedIds={selectedIds}
          onSelect={select}
          expand={expand}
          onDropAdd={onDropAdd}
          zoom={zoom}
          names={names}
        />
      </section>

      <span className={styles.threeChip} aria-hidden>
        <b>3D</b> live
      </span>

      <nav className={styles.addBar} aria-label="Add to the floor" data-panel-overlay>
        <div className={styles.libraryWrap}>
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
              {library === null ? (
                <p className={styles.hint}>Loading your Objects…</p>
              ) : library.length === 0 ? (
                <p className={styles.hint}>
                  No Objects yet. Add one in your Artwork library, then ask for its 3D model.
                </p>
              ) : (
                <ul>
                  {library.map((a) => (
                    <li key={a.id}>
                      <Button
                        variant="bare"
                        className={styles.libraryRow}
                        disabled={!a.ready}
                        draggable={a.ready}
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
                          a.ready
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
                            {a.ready
                              ? a.boundsCm
                                ? `${Math.round(a.boundsCm.w)} × ${Math.round(a.boundsCm.d)} × ${Math.round(a.boundsCm.h)} cm`
                                : '3D model ready'
                              : a.status === 'requested'
                                ? '3D model in preparation'
                                : 'No 3D model yet'}
                          </span>
                        </span>
                      </Button>
                    </li>
                  ))}
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
