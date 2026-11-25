/**
 * An exhibition's floor (docs/objects O6, "In the 3D space"): the Objects and pedestals standing
 * on its rooms' floors. Stored as one JSON value on the exhibition (`Exhibition.floorLayout`, like
 * the benches), frozen into the published snapshot for visitors, part of the bake fingerprint.
 *
 * Positions are the room's world coordinates in METRES (x, z; y up), as the 3D scene uses them.
 * Turns are degrees (three.js Euler order 'YXZ': the turn about the vertical, then the tilt and the
 * lean in the item's own frame), about the item's bounding-box centre.
 *
 * Floor composing (2026-11-25, docs/superpowers/specs/2026-11-25-floor-attach-any-side-design.md):
 * any item (an Object or a pedestal) is free in the room or attached to one FACE of another item's
 * bounding box, stored RELATIVE to it, so moving or turning the parent carries it (chains too):
 * - free: `x` / `z` its box centre, `lift` its lowest point above the floor (cm), turns in room axes;
 * - attached: `parentId` + `face`; on a top / bottom `offsetX` / `offsetZ` from the face's centre in
 *   the parent's frame, on a side `offsetX` across (to the right looking at the face) and `offsetY`
 *   up (cm); `lift` the gap off the face; turns relative to its rest on the face (on a side: its back
 *   against it). `floorPlacement.ts` resolves where everything is.
 * Layouts saved before (an Object's `pedestalId`) read as attached to that pedestal's top.
 *
 * Pure and client-safe. `parseFloorLayout` is the only way in: it drops anything malformed rather
 * than failing a save, and clamps every number to a sane range.
 */
import {
  PEDESTAL_DEFAULT_LOOK,
  PEDESTAL_MATERIALS,
  PEDESTAL_SHAPES,
  WOOD_ALIASES,
  type PedestalEdges,
  type PedestalFinish,
  type PedestalShapeId,
} from './pedestals'

/** A face of an item's bounding box: front = its own +z, right = +x. */
export type FloorFace = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'

export const FLOOR_FACES: readonly FloorFace[] = ['top', 'bottom', 'front', 'back', 'left', 'right']

export const isSideFace = (face: FloorFace) => face !== 'top' && face !== 'bottom'

/** Where an item is: free in the room, or on a face of another (see the header). */
export type FloorPlacementFields = {
  /** The room (index in the space's room list) whose floor it stands on. */
  room: number
  x: number
  z: number
  rotX: number
  rotY: number
  rotZ: number
  /** Free: its lowest point above the floor (cm). Attached: the gap off its face (cm). */
  lift: number
  parentId: string | null
  face: FloorFace
  offsetX: number
  offsetY: number
  offsetZ: number
  locked: boolean
}

export type FloorObject = FloorPlacementFields & {
  kind: 'object'
  id: string
  artworkId: string
  /** 1 = real size; proportional only. */
  scale: number
  castShadow: boolean
}

export type FloorPedestal = FloorPlacementFields & {
  kind: 'pedestal'
  id: string
  /** "Pedestal 1". */
  name: string
  shape: PedestalShapeId
  /** cm; round shapes keep w = d (the diameter). */
  w: number
  d: number
  h: number
  edges: PedestalEdges
  material: string
  /** A colour id from the material's list, or '#rrggbb' where any colour is allowed. */
  colour: string
  finish: PedestalFinish
}

export type FloorItem = FloorObject | FloorPedestal

/** A group the artist made (⌘G): moved, turned and aligned as one. */
export type FloorGroup = { id: string; name: string; memberIds: string[] }

export type FloorLayout = { version: 1; items: FloorItem[]; groups: FloorGroup[] }

export const EMPTY_FLOOR: FloorLayout = { version: 1, items: [], groups: [] }

export const MAX_FLOOR_ITEMS = 200
const MAX_ROOM_M = 200
const MAX_PEDESTAL_CM = 600
const MAX_LIFT_CM = 1000
const MAX_OFFSET_CM = 1000

const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

const str = (v: unknown, max = 100) => (typeof v === 'string' ? v.slice(0, max) : '')

const idOf = (v: unknown) => {
  const s = str(v, 64)
  return /^[A-Za-z0-9_-]+$/.test(s) ? s : ''
}

/** Degrees in (−180, 180]. */
const angle = (v: unknown) => {
  const a = num(v, -1e6, 1e6, 0) % 360
  return a > 180 ? a - 360 : a <= -180 ? a + 360 : a
}

/** The fields every item shares. An O6 Object's `pedestalId` is its parent, on the top. */
function parsePlacement(raw: Record<string, unknown>): FloorPlacementFields {
  const parentId = idOf(raw.parentId ?? raw.pedestalId) || null
  const face = FLOOR_FACES.includes(raw.face as FloorFace) ? (raw.face as FloorFace) : 'top'
  const offset = (v: unknown) => (parentId ? num(v, -MAX_OFFSET_CM, MAX_OFFSET_CM, 0) : 0)
  return {
    room: Math.round(num(raw.room, 0, 50, 0)),
    x: num(raw.x, -MAX_ROOM_M, MAX_ROOM_M, 0),
    z: num(raw.z, -MAX_ROOM_M, MAX_ROOM_M, 0),
    rotX: angle(raw.rotX),
    rotY: angle(raw.rotY),
    rotZ: angle(raw.rotZ),
    lift: num(raw.lift, 0, MAX_LIFT_CM, 0),
    parentId,
    face: parentId ? face : 'top',
    offsetX: offset(raw.offsetX),
    offsetY: offset(raw.offsetY),
    offsetZ: offset(raw.offsetZ),
    locked: raw.locked === true,
  }
}

function parseObject(raw: Record<string, unknown>): FloorObject | null {
  const id = idOf(raw.id)
  const artworkId = str(raw.artworkId, 64)
  if (!id || !artworkId) return null
  return {
    kind: 'object',
    id,
    artworkId,
    ...parsePlacement(raw),
    scale: num(raw.scale, 0.05, 20, 1),
    castShadow: raw.castShadow !== false,
  }
}

function parsePedestal(raw: Record<string, unknown>): FloorPedestal | null {
  const id = idOf(raw.id)
  if (!id) return null
  const shape = PEDESTAL_SHAPES.find((s) => s.id === raw.shape) ?? PEDESTAL_SHAPES[1]
  const material = PEDESTAL_MATERIALS.find((m) => m.id === raw.material) ?? PEDESTAL_MATERIALS[0]
  const colourRaw =
    material.id === 'wood' ? (WOOD_ALIASES[str(raw.colour, 16)] ?? str(raw.colour, 16)) : str(raw.colour, 16)
  const colour =
    material.colours.some((c) => c.id === colourRaw) ||
    (material.anyColour && /^#[0-9a-fA-F]{6}$/.test(colourRaw))
      ? colourRaw
      : material.colours[0].id
  // Down to 1 cm across: a plank is 3 cm deep.
  const w = num(raw.w, 1, MAX_PEDESTAL_CM, shape.defaults.w)
  const d = shape.round || shape.equal ? w : num(raw.d, 1, MAX_PEDESTAL_CM, shape.defaults.d)
  const h = shape.equal ? w : num(raw.h, 2, MAX_PEDESTAL_CM, shape.defaults.h)
  const edges = ['sharp', 'soft', 'round'].includes(raw.edges as string)
    ? (raw.edges as PedestalEdges)
    : PEDESTAL_DEFAULT_LOOK.edges
  const finish = ['matte', 'satin', 'gloss'].includes(raw.finish as string)
    ? (raw.finish as PedestalFinish)
    : PEDESTAL_DEFAULT_LOOK.finish
  return {
    kind: 'pedestal',
    id,
    name: str(raw.name, 60) || 'Pedestal',
    ...parsePlacement(raw),
    shape: shape.id,
    w,
    d,
    h,
    edges,
    material: material.id,
    colour,
    finish,
  }
}

/** Free where it was last placed: its own x / z / lift and turns, no parent. */
const freed = (item: FloorItem): FloorItem => ({
  ...item,
  parentId: null,
  face: 'top',
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
})

/**
 * Whatever arrived (a request body, a stored value, a snapshot) → a valid floor. Malformed items
 * are dropped; an item whose parent is missing, itself, in another room or in a loop stands free
 * where it was last placed; groups keep only members that exist.
 */
export function parseFloorLayout(raw: unknown): FloorLayout {
  if (!raw || typeof raw !== 'object') return EMPTY_FLOOR
  const value = raw as { items?: unknown; groups?: unknown }
  const items: FloorItem[] = []
  const seen = new Set<string>()
  // An Object is a unique piece: once per floor (owner, 2026-11-25). Pedestals repeat freely.
  const placedArtworks = new Set<string>()
  for (const entry of Array.isArray(value.items) ? value.items.slice(0, MAX_FLOOR_ITEMS) : []) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const item =
      e.kind === 'pedestal' ? parsePedestal(e) : e.kind === 'object' ? parseObject(e) : null
    if (!item || seen.has(item.id)) continue
    if (item.kind === 'object') {
      if (placedArtworks.has(item.artworkId)) continue
      placedArtworks.add(item.artworkId)
    }
    seen.add(item.id)
    items.push(item)
  }
  const byId = new Map(items.map((i) => [i.id, i]))
  for (let k = 0; k < items.length; k++) {
    const item = items[k]
    if (!item.parentId) continue
    const parent = byId.get(item.parentId)
    let ok = !!parent && parent.id !== item.id && parent.room === item.room
    // A loop: following the parents comes back to it.
    for (let up = parent, steps = 0; ok && up?.parentId && steps <= items.length; steps++) {
      if (up.parentId === item.id) ok = false
      up = byId.get(up.parentId)
    }
    if (!ok) {
      items[k] = freed(item)
      byId.set(item.id, items[k])
    }
  }
  const groups: FloorGroup[] = []
  for (const entry of Array.isArray(value.groups) ? value.groups.slice(0, 50) : []) {
    if (!entry || typeof entry !== 'object') continue
    const g = entry as Record<string, unknown>
    const id = idOf(g.id)
    const memberIds = Array.isArray(g.memberIds)
      ? g.memberIds.filter((m): m is string => typeof m === 'string' && seen.has(m))
      : []
    if (id && memberIds.length >= 2)
      groups.push({ id, name: str(g.name, 60) || 'Group', memberIds })
  }
  return { version: 1, items, groups }
}

/** The floor without one artwork (it was deleted, or left the exhibition). */
export function withoutArtwork(layout: FloorLayout, artworkId: string): FloorLayout {
  const items = layout.items.filter((i) => !(i.kind === 'object' && i.artworkId === artworkId))
  const ids = new Set(items.map((i) => i.id))
  return {
    ...layout,
    items,
    groups: layout.groups
      .map((g) => ({ ...g, memberIds: g.memberIds.filter((m) => ids.has(m)) }))
      .filter((g) => g.memberIds.length >= 2),
  }
}

/** The artworks the floor shows. */
export const floorArtworkIds = (layout: FloorLayout) => [
  ...new Set(layout.items.flatMap((i) => (i.kind === 'object' ? [i.artworkId] : []))),
]
