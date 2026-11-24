/**
 * An exhibition's floor (docs/objects O6, "In the 3D space"): the Objects and pedestals standing
 * on its rooms' floors. Stored as one JSON value on the exhibition (`Exhibition.floorLayout`, like
 * the benches), frozen into the published snapshot for visitors, part of the bake fingerprint.
 *
 * Positions are the room's world coordinates in METRES (x, z; y up), as the 3D scene uses them.
 * Rotation is degrees around the vertical. An Object on a pedestal is stored RELATIVE to it (the
 * offset of its base from the top's centre, in cm, in the pedestal's own frame), so moving or
 * turning the pedestal carries it. `lift` is cm above the floor, or above the pedestal's top.
 *
 * Pure and client-safe. `parseFloorLayout` is the only way in: it drops anything malformed rather
 * than failing a save, and clamps every number to a sane range.
 */
import {
  PEDESTAL_DEFAULT_LOOK,
  PEDESTAL_MATERIALS,
  PEDESTAL_SHAPES,
  type PedestalEdges,
  type PedestalFinish,
  type PedestalShapeId,
} from './pedestals'

export type FloorObject = {
  kind: 'object'
  id: string
  artworkId: string
  /** The room (index in the space's room list) whose floor it stands on. */
  room: number
  x: number
  z: number
  rotY: number
  /** 1 = real size; proportional only. */
  scale: number
  lift: number
  castShadow: boolean
  /** On a pedestal: its id, and the base's offset from the top's centre (cm, pedestal frame). */
  pedestalId: string | null
  offsetX: number
  offsetZ: number
  locked: boolean
}

export type FloorPedestal = {
  kind: 'pedestal'
  id: string
  /** "Pedestal 1". */
  name: string
  room: number
  x: number
  z: number
  rotY: number
  lift: number
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
  locked: boolean
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

function parseObject(raw: Record<string, unknown>): FloorObject | null {
  const id = idOf(raw.id)
  const artworkId = str(raw.artworkId, 64)
  if (!id || !artworkId) return null
  const pedestalId = idOf(raw.pedestalId) || null
  return {
    kind: 'object',
    id,
    artworkId,
    room: Math.round(num(raw.room, 0, 50, 0)),
    x: num(raw.x, -MAX_ROOM_M, MAX_ROOM_M, 0),
    z: num(raw.z, -MAX_ROOM_M, MAX_ROOM_M, 0),
    rotY: angle(raw.rotY),
    scale: num(raw.scale, 0.05, 20, 1),
    lift: num(raw.lift, 0, MAX_LIFT_CM, 0),
    castShadow: raw.castShadow !== false,
    pedestalId,
    offsetX: pedestalId ? num(raw.offsetX, -MAX_PEDESTAL_CM, MAX_PEDESTAL_CM, 0) : 0,
    offsetZ: pedestalId ? num(raw.offsetZ, -MAX_PEDESTAL_CM, MAX_PEDESTAL_CM, 0) : 0,
    locked: raw.locked === true,
  }
}

function parsePedestal(raw: Record<string, unknown>): FloorPedestal | null {
  const id = idOf(raw.id)
  if (!id) return null
  const shape = PEDESTAL_SHAPES.find((s) => s.id === raw.shape) ?? PEDESTAL_SHAPES[1]
  const material = PEDESTAL_MATERIALS.find((m) => m.id === raw.material) ?? PEDESTAL_MATERIALS[0]
  const colourRaw = str(raw.colour, 16)
  const colour =
    material.colours.some((c) => c.id === colourRaw) ||
    (material.anyColour && /^#[0-9a-fA-F]{6}$/.test(colourRaw))
      ? colourRaw
      : material.colours[0].id
  const w = num(raw.w, 5, MAX_PEDESTAL_CM, shape.defaults.w)
  const d = shape.round || shape.equal ? w : num(raw.d, 5, MAX_PEDESTAL_CM, shape.defaults.d)
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
    room: Math.round(num(raw.room, 0, 50, 0)),
    x: num(raw.x, -MAX_ROOM_M, MAX_ROOM_M, 0),
    z: num(raw.z, -MAX_ROOM_M, MAX_ROOM_M, 0),
    rotY: angle(raw.rotY),
    lift: num(raw.lift, 0, MAX_LIFT_CM, 0),
    shape: shape.id,
    w,
    d,
    h,
    edges,
    material: material.id,
    colour,
    finish,
    locked: raw.locked === true,
  }
}

/**
 * Whatever arrived (a request body, a stored value, a snapshot) → a valid floor. Malformed items
 * are dropped; an Object pointing at a pedestal that isn't there stands on the floor instead;
 * groups keep only members that exist.
 */
export function parseFloorLayout(raw: unknown): FloorLayout {
  if (!raw || typeof raw !== 'object') return EMPTY_FLOOR
  const value = raw as { items?: unknown; groups?: unknown }
  const items: FloorItem[] = []
  const seen = new Set<string>()
  for (const entry of Array.isArray(value.items) ? value.items.slice(0, MAX_FLOOR_ITEMS) : []) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const item =
      e.kind === 'pedestal' ? parsePedestal(e) : e.kind === 'object' ? parseObject(e) : null
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    items.push(item)
  }
  const pedestals = new Set(items.filter((i) => i.kind === 'pedestal').map((i) => i.id))
  for (const item of items) {
    if (item.kind === 'object' && item.pedestalId && !pedestals.has(item.pedestalId)) {
      item.pedestalId = null
      item.offsetX = 0
      item.offsetZ = 0
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
