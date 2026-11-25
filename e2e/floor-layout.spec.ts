import { test, expect } from '@playwright/test'
import { BoxGeometry } from 'three'

import { boardUVs } from '../src/components/scene/floor/boardUVs'
import { WOOD_TILE_M } from '../src/components/scene/spaces/objects/Frame/woodTextures'

import {
  nextName,
  parseFloorLayout,
  withShape,
  withoutArtwork,
  type FloorItem,
  type FloorObject,
  type FloorPedestal,
} from '../src/lib/floor/floorLayout'
import {
  attachTo,
  belowFloor,
  detachItem,
  dropItem,
  keepChildrenOnFaces,
  modelOffset,
  movingWith,
  overhangs,
  placeMap,
  raiseBy,
  removeItems,
  rotateOffset,
  sameSpots,
  slideOnFace,
  supportUnder,
} from '../src/lib/floor/floorPlacement'
import type { FloorSizes } from '../src/lib/floor/floorArtworks'
import { clickedSide, sideFace, toObject, toWorld } from '../src/lib/floor/objectSide'
import { insideOutline, pedestalShape, pedestalTop } from '../src/lib/floor/pedestals'

// Objects O6 (docs/objects "Snapping, exactly") and floor composing (2026-11-25,
// docs/superpowers/specs/2026-11-25-floor-attach-any-side-design.md): the floor's data and placement. Pure.

const pedestal = (patch: Partial<FloorPedestal> = {}): FloorPedestal => ({
  kind: 'pedestal',
  id: 'p1',
  name: 'Pedestal 1',
  room: 0,
  x: 2,
  z: 3,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  lift: 0,
  parentId: null,
  face: 'top',
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  shape: 'box',
  w: 40,
  d: 40,
  h: 90,
  edges: 'soft',
  material: 'painted',
  colour: 'white',
  finish: 'matte',
  locked: false,
  ...patch,
})

const object = (patch: Partial<FloorObject> = {}): FloorObject => ({
  kind: 'object',
  id: 'o1',
  artworkId: 'a1',
  room: 0,
  x: 0,
  z: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  scale: 1,
  lift: 0,
  castShadow: true,
  parentId: null,
  face: 'top',
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  locked: false,
  ...patch,
})

/** A sculpture's model: 50 cm high, 20 wide, 10 deep; Alejandro's: 57.8 × 22.4 × 15.4. */
const sizes: FloorSizes = { a1: { h: 50, w: 20, d: 10 }, alejandro: { h: 57.8, w: 22.4, d: 15.4 } }

const layoutOf = (...items: FloorItem[]) => ({ version: 1 as const, items, groups: [] })
const at = (layout: { items: FloorItem[] }, id: string, s: FloorSizes = sizes) =>
  placeMap({ version: 1, items: layout.items, groups: [] }, s).get(id)!

/** A 20 × 3 × 100 cm plank against a wall at z = −2, raised 100 cm. */
const plank = (patch: Partial<FloorPedestal> = {}) =>
  pedestal({ id: 'pl', name: 'Plank 1', shape: 'plank', w: 20, d: 3, h: 100, x: 0, z: -2, lift: 100, ...patch })

test('parse: drops what is malformed, clamps numbers, frees Objects whose pedestal is gone', () => {
  const parsed = parseFloorLayout({
    items: [
      {
        kind: 'object',
        id: 'o1',
        artworkId: 'a1',
        x: 1e9,
        scale: 99,
        pedestalId: 'gone',
        offsetX: 5,
      },
      {
        kind: 'pedestal',
        id: 'p1',
        shape: 'cylinder',
        w: 50,
        d: 80,
        material: 'metal',
        colour: '#ff0000',
      },
      { kind: 'mystery', id: 'x' },
      { kind: 'object', id: 'o1', artworkId: 'dup' },
      { kind: 'object', id: 'bad id!', artworkId: 'a2' },
    ],
    groups: [{ id: 'g1', memberIds: ['o1', 'nope'] }],
  })
  expect(parsed.items.map((i) => i.id)).toEqual(['o1', 'p1'])
  const o = parsed.items[0] as FloorObject
  expect(o.x).toBe(200)
  expect(o.scale).toBe(20)
  expect(o.parentId).toBeNull()
  expect(o.offsetX).toBe(0)
  const p = parsed.items[1] as FloorPedestal
  // Round: the diameter twice. Metal takes no custom colour: its first one.
  expect([p.w, p.d]).toEqual([50, 50])
  expect(p.colour).toBe('brushedSteel')
  // A group needs two members that exist.
  expect(parsed.groups).toEqual([])
  expect(parseFloorLayout(null)).toEqual({ version: 1, items: [], groups: [] })
})

test('old layout: an Object on a pedestal places exactly as before (pedestalId)', () => {
  // As O6 saved it: no parentId, face, rotX / rotZ or offsetY.
  const layout = parseFloorLayout({
    items: [
      { kind: 'pedestal', id: 'p1', x: 2, z: 3, rotY: 90, lift: 10, shape: 'box', w: 40, d: 40, h: 90 },
      { kind: 'object', id: 'o1', artworkId: 'a1', pedestalId: 'p1', offsetX: 10, offsetZ: 0, rotY: 30, lift: 5 },
    ],
  })
  const o = layout.items[1] as FloorObject
  expect([o.parentId, o.face, o.rotX, o.rotZ, o.offsetY]).toEqual(['p1', 'top', 0, 0, 0])
  const where = at(layout, 'o1')
  // 10 cm along the pedestal's x, which faces −z after a 90° turn.
  const [dx, dz] = rotateOffset(10, 0, 90)
  expect(dz).toBeCloseTo(-10)
  expect(where.x).toBeCloseTo(2 + dx / 100)
  expect(where.z).toBeCloseTo(3 + dz / 100)
  // The base on the top: 10 raised + 90 high + 5 above it.
  expect(where.y).toBeCloseTo((10 + 90 + 5) / 100)
  expect(where.cy).toBeCloseTo((10 + 90 + 5 + 25) / 100)
  expect(where.rotY).toBeCloseTo(120)
  expect(where.upright).toBe(true)
  // The pedestal itself: base at its lift.
  expect(at(layout, 'p1').y).toBeCloseTo(0.1)
  expect(at(layout, 'p1').cy).toBeCloseTo(0.55)
})

test("a sculpture on a raised plank's front: back against it, touching, at the offsets", () => {
  const s = object({ id: 's', artworkId: 'alejandro', parentId: 'pl', face: 'front', offsetX: 5, offsetY: 10 })
  const flat = layoutOf(plank(), s)
  const where = at(flat, 's')
  // The plank's front is at z = −2 + 1.5 cm; the sculpture's back touches it.
  expect(where.min.z).toBeCloseTo(-2 + 0.015)
  expect(where.z).toBeCloseTo(-2 + 0.015 + 0.077)
  // 5 cm to the right looking at the face, 10 cm above its middle (150 cm).
  expect(where.x).toBeCloseTo(0.05)
  expect(where.cy).toBeCloseTo(1.6)
  expect(where.rotY).toBeCloseTo(0)
  // The plank turned 90°: its front faces +x, the sculpture with it.
  const turned = at(layoutOf(plank({ rotY: 90 }), s), 's')
  expect(turned.min.x).toBeCloseTo(0.015)
  expect(turned.rotY).toBeCloseTo(90)
  // A gap pushes it out along the face's normal.
  expect(at(layoutOf(plank(), { ...s, lift: 2 }), 's').min.z).toBeCloseTo(-2 + 0.035)
  // On the back: it faces out the other way.
  const back = at(layoutOf(plank(), { ...s, face: 'back', offsetX: 0 }), 's')
  expect(back.max.z).toBeCloseTo(-2 - 0.015)
  expect(Math.abs(back.rotY)).toBeCloseTo(180)
})

test('a tilt never sinks: a free item rests by its lowest point', () => {
  const lying = at(layoutOf(object({ rotX: 90 })), 'o1')
  // Tilted forward 90°: its 10 cm depth is now its height.
  expect(lying.y).toBeCloseTo(0)
  expect(lying.cy).toBeCloseTo(0.05)
  expect(lying.upright).toBe(false)
  const leaning = at(layoutOf(object({ rotZ: 45, lift: 20 })), 'o1')
  expect(leaning.min.y).toBeCloseTo(0.2)
  const k = Math.SQRT1_2
  expect(leaning.cy).toBeCloseTo(0.2 + (0.25 * k + 0.1 * k))
  // Turn first, then the tilt in its own frame ('YXZ'): the heading stays the turn.
  expect(at(layoutOf(object({ rotY: 30, rotX: 20 })), 'o1').rotY).toBeCloseTo(30)
})

test('the bottom face hangs it under, touching; below the floor shows', () => {
  const p = pedestal({ lift: 150 })
  const hung = object({ parentId: 'p1', face: 'bottom' })
  const where = at(layoutOf(p, hung), 'o1')
  expect(where.max.y).toBeCloseTo(1.5)
  expect(where.cy).toBeCloseTo(1.25)
  expect(belowFloor(where)).toBe(false)
  expect(belowFloor(at(layoutOf(pedestal({ lift: 20 }), hung), 'o1'))).toBe(true)
})

test('a chain moves as one; detach keeps it in place and keeps its children', () => {
  const block = pedestal({ id: 'b', h: 120, x: 1, z: 1 })
  const board = plank({ parentId: 'b', face: 'top', lift: 0 })
  const s = object({ id: 's', artworkId: 'alejandro', parentId: 'pl', face: 'front' })
  const layout = layoutOf(block, board, s)
  const before = at(layout, 's')
  expect(before.y).toBeCloseTo(1.2 + 0.5 - 0.289)
  const moved = at(layoutOf({ ...block, x: 2 }, board, s), 's')
  expect(moved.x).toBeCloseTo(before.x + 1)
  expect(at(layoutOf({ ...block, rotY: 90 }, board, s), 's').rotY).toBeCloseTo(90)
  // Detach the plank: everything stays where it is; the sculpture is still on it.
  const free = detachItem(layout, board, sizes)
  expect(free.parentId).toBeNull()
  const after = layoutOf(block, free, s)
  expect(at(after, 'pl').cy).toBeCloseTo(at(layout, 'pl').cy)
  expect(at(after, 's').x).toBeCloseTo(before.x)
  expect(at(after, 's').cy).toBeCloseTo(before.cy)
  expect(at(after, 's').z).toBeCloseTo(before.z)
  // A tilted item detached keeps its tilt and its place.
  const tilted = { ...s, rotX: 20 }
  const tLayout = layoutOf(block, board, tilted)
  const freed = detachItem(tLayout, tilted, sizes)
  const a = at(tLayout, 's')
  const b = at(layoutOf(block, board, freed), 's')
  expect([b.x, b.cy, b.z]).toEqual([
    expect.closeTo(a.x, 4),
    expect.closeTo(a.cy, 4),
    expect.closeTo(a.z, 4),
  ])
  expect(b.quaternion.angleTo(a.quaternion)).toBeCloseTo(0, 3)
})

test('removing a parent frees its children in place; theirs stay on them', () => {
  const block = pedestal({ id: 'b', h: 120 })
  const board = plank({ parentId: 'b', face: 'top', lift: 0 })
  const s = object({ id: 's', artworkId: 'alejandro', parentId: 'pl', face: 'front' })
  const layout = layoutOf(block, board, s)
  const next = removeItems(layout, new Set(['b']), sizes)
  expect(next.items.map((i) => i.id)).toEqual(['pl', 's'])
  expect(next.items[0].parentId).toBeNull()
  expect(next.items[1].parentId).toBe('pl')
  expect(at(next, 's').cy).toBeCloseTo(at(layout, 's').cy)
})

test('parse frees loops, missing parents, itself and other rooms', () => {
  const { items } = parseFloorLayout({
    items: [
      pedestal({ id: 'a', parentId: 'b', face: 'front' }),
      pedestal({ id: 'b', parentId: 'a', face: 'back' }),
      pedestal({ id: 'c', parentId: 'c' }),
      pedestal({ id: 'd', parentId: 'zz' }),
      pedestal({ id: 'e', room: 1, parentId: 'b' }),
      object({ id: 'o', parentId: 'b', face: 'sideways' as never }),
    ],
  })
  const byId = new Map(items.map((i) => [i.id, i]))
  // The loop is broken once; nothing points at itself.
  expect([byId.get('a')!.parentId, byId.get('b')!.parentId]).toContain(null)
  expect(byId.get('c')!.parentId).toBeNull()
  expect(byId.get('d')!.parentId).toBeNull()
  expect(byId.get('e')!.parentId).toBeNull()
  expect(byId.get('o')!.face).toBe('top')
})

test('drop: onto a pedestal centred the first time, then it slides; Alt never snaps', () => {
  const p = pedestal()
  const layout = layoutOf(p, object())
  const first = dropItem(layout, object(), 2.1, 3.05, sizes)
  expect([first.parentId, first.face]).toEqual(['p1', 'top'])
  expect([first.offsetX, first.offsetZ]).toEqual([0, 0])
  const slid = dropItem(layoutOf(p, first), first, 2.1, 3.05, sizes)
  expect([slid.offsetX, slid.offsetZ]).toEqual([10, 5])
  expect(dropItem(layout, object(), 2.1, 3.05, sizes, { snap: false }).parentId).toBeNull()
  // Off every top: on the floor.
  const off = dropItem(layout, first, 5, 5, sizes)
  expect([off.parentId, off.lift]).toEqual([null, 0])
})

test('drop: only Objects snap; a side only of an item off the floor, at its middle', () => {
  // A pedestal over another's top stays on the floor.
  const p = pedestal()
  const other = pedestal({ id: 'p2', x: 0, z: 0 })
  expect(dropItem(layoutOf(p, other), other, 2, 3, sizes).parentId).toBeNull()
  // Beside a pedestal standing on the floor: no side attach.
  const near = object({ id: 's', artworkId: 'alejandro' })
  const beside = dropItem(layoutOf(p, near), near, 2 + 0.2 + 0.077 + 0.01, 3, sizes, { sideTolCm: 5 })
  expect(beside.parentId).toBeNull()
  // Against the raised plank's front, 1 cm off it: on its front, its middle height, facing out.
  const turned = { ...near, rotY: 30 }
  const onPlank = dropItem(layoutOf(plank(), turned), turned, 0.03, -2 + 0.015 + 0.077 + 0.01, sizes, {
    sideTolCm: 5,
  })
  expect([onPlank.parentId, onPlank.face, onPlank.offsetY, onPlank.rotY]).toEqual(['pl', 'front', 0, 0])
  expect(onPlank.offsetX).toBeCloseTo(3)
  // A low plank: raised so nothing ends below the floor.
  const low = plank({ lift: 5, h: 20 })
  const onLow = dropItem(layoutOf(low, near), near, 0, -2 + 0.015 + 0.077 + 0.01, sizes, { sideTolCm: 5 })
  expect(onLow.parentId).toBe('pl')
  expect(at(layoutOf(low, onLow), 's').y).toBeCloseTo(0, 2)
  // Too far from the face: free.
  const far = dropItem(layoutOf(plank(), near), near, 0, -1.5, sizes, { sideTolCm: 5 })
  expect(far.parentId).toBeNull()
})

test('the highest top wins where tops overlap; another room, itself and its own children never count', () => {
  const low = pedestal({ id: 'low', h: 40 })
  const high = pedestal({ id: 'high', h: 100 })
  const elsewhere = pedestal({ id: 'far', room: 1, h: 200 })
  const layout = layoutOf(low, high, elsewhere)
  expect(supportUnder(layout, sizes, 0, 2, 3, new Set())?.id).toBe('high')
  expect(supportUnder(layout, sizes, 0, 2, 3, new Set(['high']))?.id).toBe('low')
})

test('attaching: on a new side it faces out; on a top it keeps the turn it was seen with', () => {
  const s = object({ id: 's', artworkId: 'alejandro', rotY: 30, rotX: 10 })
  const onSide = attachTo(layoutOf(plank(), s), s, 'pl', 'front', null, sizes)
  expect([onSide.rotX, onSide.rotY, onSide.rotZ, onSide.offsetX, onSide.offsetY]).toEqual([0, 0, 0, 0, 0])
  const p = pedestal({ rotY: 10 })
  const onTop = attachTo(layoutOf(p, s), s, 'p1', 'top', null, sizes)
  expect(onTop.rotY).toBeCloseTo(20)
  expect(onTop.rotX).toBe(10)
  // At a point: its centre lands there on the face.
  const there = attachTo(layoutOf(plank(), s), s, 'pl', 'front', { x: -0.04, y: 1.3, z: -1.98 }, sizes)
  expect(there.offsetX).toBeCloseTo(-4)
  expect(there.offsetY).toBeCloseTo(-20)
  // An item never attaches to itself or below itself.
  const board = plank()
  const child = { ...s, parentId: 'pl', face: 'front' as const }
  expect(attachTo(layoutOf(board, child), board, 's', 'top', null, sizes)).toBe(board)
})

test('resizing keeps children that still fit, re-centres the others (tops and sides)', () => {
  const p = pedestal({ w: 100, d: 100 })
  const near = object({ id: 'near', parentId: 'p1', offsetX: 10 })
  const far = object({ id: 'far', parentId: 'p1', offsetX: 45 })
  const smaller = { ...p, w: 40, d: 40 }
  const kept = keepChildrenOnFaces(layoutOf(smaller, near, far), 'p1', sizes)
  expect((kept.items.find((i) => i.id === 'near') as FloorObject).offsetX).toBe(10)
  expect((kept.items.find((i) => i.id === 'far') as FloorObject).offsetX).toBe(0)
  const s = object({ id: 's', artworkId: 'alejandro', parentId: 'pl', face: 'front', offsetX: 8, offsetY: 30 })
  const thin = plank({ w: 10 })
  const onThin = keepChildrenOnFaces(layoutOf(thin, s), 'pl', sizes).items[1]
  expect([onThin.offsetX, onThin.offsetY]).toEqual([0, 0])
})

test('an Object wider than its face overhangs; no size: 40 cm everywhere, finite', () => {
  const s = object({ id: 's', artworkId: 'alejandro', parentId: 'pl', face: 'front' })
  expect(overhangs(layoutOf(plank(), s), s, sizes)).toBe(true)
  expect(overhangs(layoutOf(plank({ w: 40 }), s), s, sizes)).toBe(false)
  const unknown = object({ artworkId: 'nobody' })
  const where = at(layoutOf(unknown), 'o1', {})
  expect(where.cy).toBeCloseTo(0.2)
  expect([where.size.w, where.size.h, where.size.d]).toEqual([40, 40, 40])
  const onIt = pedestal({ parentId: 'o1', face: 'top' })
  const above = at(layoutOf(unknown, onIt), 'p1', {})
  expect(Number.isFinite(above.cy)).toBe(true)
  expect(above.y).toBeCloseTo(0.4)
})

test('tops follow the shape: tapered is smaller, a table is its top', () => {
  const tapered = pedestalTop('tapered', 100, 100, 90).outline
  expect(insideOutline(tapered, 40, 0)).toBe(false)
  expect(insideOutline(tapered, 30, 0)).toBe(true)
  const round = pedestalTop('cylinder', 100, 100, 90).outline
  expect(insideOutline(round, 40, 40)).toBe(false)
  expect(insideOutline(round, 30, 30)).toBe(true)
  expect(pedestalTop('table', 120, 80, 75).height).toBe(75)
})

test('a deleted artwork leaves the floor and its groups', () => {
  const layout = {
    version: 1 as const,
    items: [
      object({ id: 'o1', artworkId: 'a1' }),
      object({ id: 'o2', artworkId: 'a2' }),
      pedestal(),
    ],
    groups: [{ id: 'g', name: 'Group 1', memberIds: ['o1', 'o2'] }],
  }
  const next = withoutArtwork(layout, 'a1')
  expect(next.items.map((i) => i.id)).toEqual(['o2', 'p1'])
  expect(next.groups).toEqual([])
})

test('an Object is a unique piece: a second copy of the same artwork is dropped; pedestals repeat', () => {
  const parsed = parseFloorLayout({
    items: [
      object({ id: 'o1', artworkId: 'a1' }),
      object({ id: 'o2', artworkId: 'a1', x: 3 }),
      object({ id: 'o3', artworkId: 'a2' }),
      pedestal({ id: 'p1' }),
      pedestal({ id: 'p2' }),
    ],
  })
  expect(parsed.items.map((i) => i.id)).toEqual(['o1', 'o3', 'p1', 'p2'])
})

test('a click on an Object stands the camera in front of that side; the top or bottom, the nearest side facing it', () => {
  // A trunk 180 × 87 cm on the floor, 64 cm high, unturned.
  const half = { w: 0.9, d: 0.435 }
  const h = 0.64
  const camera = { x: 0.5, y: 1.6, z: 3 } // in front (+z), a little right
  expect(clickedSide({ x: 0.2, y: 0.3, z: 0.435 }, half, h, camera)).toBe('+z')
  expect(clickedSide({ x: 0.9, y: 0.3, z: 0.1 }, half, h, camera)).toBe('+x')
  // On the top near its front edge: the front.
  expect(clickedSide({ x: 0, y: 0.64, z: 0.3 }, half, h, camera)).toBe('+z')
  // On the top near its back edge, the back facing away: the nearest side that faces the camera.
  expect(clickedSide({ x: 0, y: 0.64, z: -0.4 }, half, h, camera)).toBe('+z')
  expect(clickedSide({ x: 0.85, y: 0.64, z: -0.4 }, half, h, camera)).toBe('+x')
  // The front's middle, normal and length.
  expect(sideFace('+z', half, h)).toEqual({
    center: { x: 0, y: 0.32, z: 0.435 },
    normal: { x: 0, z: 1 },
    width: 1.8,
  })
  expect(sideFace('-x', half, h).width).toBeCloseTo(0.87)
})

test("the Object's own coordinates and the world, turned and back", () => {
  const origin = { x: 2, y: 0, z: -1 }
  const turn = Math.PI / 2
  const world = toWorld({ x: 1, y: 0.5, z: 0 }, origin, turn)
  // Turned 90° about y, its +x faces the world's −z (three's rotation.y).
  expect(world.x).toBeCloseTo(2)
  expect(world.z).toBeCloseTo(-2)
  const back = toObject(world, origin, turn)
  expect(back.x).toBeCloseTo(1)
  expect(back.y).toBeCloseTo(0.5)
  expect(back.z).toBeCloseTo(0)
})

test("parse: old wood ids map to the frames' three woods; a plank keeps 3 cm", () => {
  const raw = (id: string, colour: string, patch: Record<string, unknown> = {}) => ({
    ...pedestal({ id }),
    material: 'wood',
    colour,
    ...patch,
  })
  const { items } = parseFloorLayout({
    items: [
      raw('p1', 'walnut'),
      raw('p2', 'ebonised'),
      raw('p3', 'oak'),
      raw('p4', 'cherry'),
      raw('p5', 'ash'),
      raw('p6', 'birch'),
      raw('p7', 'dark', { shape: 'plank', w: 20, d: 3, h: 100, finish: 'gloss' }),
    ],
  })
  const colours = (items as FloorPedestal[]).map((p) => p.colour)
  expect(colours).toEqual(['dark', 'dark', 'medium', 'medium', 'light', 'light', 'dark'])
  const plank = items[6] as FloorPedestal
  expect([plank.shape, plank.w, plank.d, plank.h, plank.finish]).toEqual(['plank', 20, 3, 100, 'gloss'])
  expect(pedestalShape('plank').defaults).toEqual({ w: 20, d: 3, h: 100 })
})

test("a plank's wood runs along its length, at the frames' real board size", () => {
  // A plank's mesh: 20 × 100 × 3 cm, as pedestalGeometry builds it (non-indexed, any position).
  const g = boardUVs(new BoxGeometry(0.2, 1, 0.03).toNonIndexed())
  const uv = g.getAttribute('uv')
  const pos = g.getAttribute('position')
  expect(uv?.count).toBe(pos.count)
  // The front (facing +z): u along the 100 cm height, v across its 20 cm.
  const us: number[] = []
  const vs: number[] = []
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getZ(i) - 0.015) > 1e-6) continue
    us.push(uv.getX(i))
    vs.push(uv.getY(i))
  }
  const span = (a: number[]) => Math.max(...a) - Math.min(...a)
  expect(span(us)).toBeCloseTo(1 / WOOD_TILE_M, 3)
  expect(span(vs)).toBeCloseTo(0.2 / WOOD_TILE_M, 3)
})

test('a move on the plan slides an attached item along its face (across only on a side)', () => {
  const s = object({ id: 's', artworkId: 'alejandro', parentId: 'pl', face: 'front', offsetX: 2, offsetY: 7 })
  // The plank unturned: its front faces +z, across is +x.
  const flat = at(layoutOf(plank(), s), 'pl')
  expect(slideOnFace(s, flat, 0.1, 0.3)).toMatchObject({ offsetX: 12, offsetY: 7 })
  // Turned 90°: its front faces +x, across (to the right looking at it) is −z.
  const turned = at(layoutOf(plank({ rotY: 90 }), s), 'pl')
  expect(slideOnFace(s, turned, 0.5, 0.1).offsetX).toBeCloseTo(-8)
  // On a top: both ways, in the parent's frame.
  const p = pedestal({ rotY: 90 })
  const o = object({ parentId: 'p1', offsetX: 1, offsetZ: 1 })
  const slid = slideOnFace(o, at(layoutOf(p, o), 'p1'), 0, -0.1)
  expect(slid.offsetX).toBeCloseTo(11)
  expect(slid.offsetZ).toBeCloseTo(1)
})

test('switching to Plank gives its size and dark wood; an automatic name follows the shape', () => {
  const p = pedestal({ name: 'Pedestal 3' })
  const other = pedestal({ id: 'x', name: 'Plank 1', shape: 'plank' })
  const board = withShape(p, 'plank', [other, p])
  expect([board.shape, board.w, board.d, board.h]).toEqual(['plank', 20, 3, 100])
  expect([board.material, board.colour, board.finish, board.name]).toEqual(['wood', 'dark', 'satin', 'Plank 2'])
  // Back to a box: its sizes stay (as any shape change), its name follows.
  const back = withShape(board, 'box', [other, board])
  expect([back.shape, back.name, back.w, back.d, back.h]).toEqual(['box', 'Pedestal 1', 20, 3, 100])
  // A name the artist chose stays.
  expect(withShape({ ...p, name: 'Big block' }, 'plank', [p]).name).toBe('Big block')
  // Equal sides: one size for all three.
  const cube = withShape(p, 'cube', [p])
  expect([cube.w, cube.d, cube.h]).toEqual([40, 40, 40])
  expect(nextName('Pedestal', ['Pedestal 2', 'Plank 7', 'Pedestal 9', 'Mine'])).toBe('Pedestal 10')
  expect(nextName('Plank', [])).toBe('Plank 1')
})

test('review: an Alt-dragged support off a top keeps its height; only an Object off a top lands on the floor', () => {
  const block = pedestal({ id: 'b', h: 120 })
  const board = plank({ parentId: 'b', face: 'top', lift: 0 })
  const off = dropItem(layoutOf(block, board), board, 5, 5, sizes, { snap: false })
  expect([off.parentId, off.lift]).toEqual([null, 120])
  const o = object({ parentId: 'b', face: 'top' })
  expect(dropItem(layoutOf(block, o), o, 5, 5, sizes, { snap: false }).lift).toBe(0)
})

test('review: a click is not a move (nothing to drop)', () => {
  const a = layoutOf(plank(), object({ id: 's', artworkId: 'alejandro', x: 0, z: -1.8 }))
  expect(sameSpots(a, a, ['s'])).toBe(true)
  const moved = { ...a, items: a.items.map((i) => (i.id === 's' ? { ...i, x: 0.01 } : i)) }
  expect(sameSpots(a, moved, ['s'])).toBe(false)
  expect(sameSpots(a, moved, ['pl'])).toBe(true)
})

test('review: a model with no measured size stands on its placed box, never in the floor', () => {
  // A 1 m model (its own box from y −0.1 to 0.9) placed as the 40 cm fallback, at scale 1.
  const box = { min: { x: -0.2, y: -0.1, z: -0.3 }, max: { x: 0.2, y: 0.9, z: 0.3 } }
  const at = placeMap(layoutOf(object({ artworkId: 'nobody' })), {}).get('o1')!
  const [x, y, z] = modelOffset(box, at, 1, false)
  expect(x).toBeCloseTo(0)
  expect(z).toBeCloseTo(0)
  // Its bottom at the placed box's bottom: the group's centre is at cy, the bottom cy − 0.2.
  expect(at.cy + (box.min.y + y)).toBeCloseTo(at.y)
  // Measured: its box centred on the placed centre.
  const measured = modelOffset(box, at, 1, true)
  expect(measured[0]).toBeCloseTo(0)
  expect(measured[1]).toBeCloseTo(-0.4)
  expect(measured[2]).toBeCloseTo(0)
})

test('what a drag moves: the dragged items and everything attached to them (never snap targets)', () => {
  const block = pedestal({ id: 'b', h: 120 })
  const board = plank({ parentId: 'b', face: 'top', lift: 0 })
  const s = object({ id: 's', artworkId: 'alejandro', parentId: 'pl', face: 'front' })
  const other = pedestal({ id: 'p2', x: 5 })
  const layout = layoutOf(block, board, s, other)
  expect([...movingWith(layout, ['b'])].sort()).toEqual(['b', 'pl', 's'])
  expect([...movingWith(layout, ['s'])]).toEqual(['s'])
})

test('the 3D moves only up and down: free = height, side = Up, top = gap above, bottom = gap below', () => {
  expect(raiseBy(object({ lift: 10 }), 25).lift).toBe(35)
  expect(raiseBy(object({ lift: 10 }), -25).lift).toBe(0)
  const onSide = object({ parentId: 'pl', face: 'front', offsetY: 5, lift: 1 })
  expect([raiseBy(onSide, -12).offsetY, raiseBy(onSide, -12).lift]).toEqual([-7, 1])
  expect(raiseBy(object({ parentId: 'p1', face: 'top', lift: 2 }), 8).lift).toBe(10)
  expect(raiseBy(object({ parentId: 'p1', face: 'bottom', lift: 2 }), -8).lift).toBe(10)
  expect(raiseBy(object({ parentId: 'p1', face: 'bottom', lift: 2 }), 8).lift).toBe(0)
})
