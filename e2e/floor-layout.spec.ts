import { test, expect } from '@playwright/test'

import {
  parseFloorLayout,
  withoutArtwork,
  type FloorObject,
  type FloorPedestal,
} from '../src/lib/floor/floorLayout'
import {
  detachObject,
  dropObject,
  keepObjectsOnTop,
  pedestalTopCm,
  pedestalUnder,
  placeAll,
  placeObject,
  rotateOffset,
} from '../src/lib/floor/floorPlacement'
import { insideOutline, pedestalTop } from '../src/lib/floor/pedestals'

// Objects O6 (docs/objects "Snapping, exactly"): the floor's data and placement rules. Pure.

const pedestal = (patch: Partial<FloorPedestal> = {}): FloorPedestal => ({
  kind: 'pedestal',
  id: 'p1',
  name: 'Pedestal 1',
  room: 0,
  x: 2,
  z: 3,
  rotY: 0,
  lift: 0,
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
  rotY: 0,
  scale: 1,
  lift: 0,
  castShadow: true,
  pedestalId: null,
  offsetX: 0,
  offsetZ: 0,
  locked: false,
  ...patch,
})

const layoutOf = (...items: (FloorObject | FloorPedestal)[]) => ({
  version: 1 as const,
  items,
  groups: [],
})

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
  expect(o.pedestalId).toBeNull()
  expect(o.offsetX).toBe(0)
  const p = parsed.items[1] as FloorPedestal
  // Round: the diameter twice. Metal takes no custom colour: its first one.
  expect([p.w, p.d]).toEqual([50, 50])
  expect(p.colour).toBe('brushedSteel')
  // A group needs two members that exist.
  expect(parsed.groups).toEqual([])
  expect(parseFloorLayout(null)).toEqual({ version: 1, items: [], groups: [] })
})

test('an Object on a pedestal stands on its top, turned with it, at its offset', () => {
  const p = pedestal({ rotY: 90, lift: 10 })
  const o = object({ pedestalId: 'p1', offsetX: 10, offsetZ: 0, rotY: 30, lift: 5 })
  const at = placeObject(o, new Map([[p.id, p]]))
  // 10 cm along the pedestal's x, which faces −z after a 90° turn.
  const [dx, dz] = rotateOffset(10, 0, 90)
  expect(at.x).toBeCloseTo(2 + dx / 100)
  expect(at.z).toBeCloseTo(3 + dz / 100)
  expect(dz).toBeCloseTo(-10)
  expect(at.y).toBeCloseTo((10 + 90 + 5) / 100)
  expect(at.rotY).toBe(120)
  expect(pedestalTopCm(p)).toBe(100)
})

test('drop: onto a pedestal centred the first time, then it slides; Alt never snaps', () => {
  const p = pedestal()
  const layout = layoutOf(p, object())
  const first = dropObject(layout, object(), 2.1, 3.05)
  expect(first.pedestalId).toBe('p1')
  expect([first.offsetX, first.offsetZ]).toEqual([0, 0])
  const slid = dropObject(layoutOf(p, first), first, 2.1, 3.05)
  expect([slid.offsetX, slid.offsetZ]).toEqual([10, 5])
  expect(dropObject(layout, object(), 2.1, 3.05, { snap: false }).pedestalId).toBeNull()
  // Off every top: on the floor.
  expect(dropObject(layout, first, 5, 5).pedestalId).toBeNull()
})

test('the highest top wins where tops overlap; another room never counts', () => {
  const low = pedestal({ id: 'low', h: 40 })
  const high = pedestal({ id: 'high', h: 100 })
  const elsewhere = pedestal({ id: 'far', room: 1, h: 200 })
  expect(pedestalUnder(layoutOf(low, high, elsewhere), 0, 2, 3)?.id).toBe('high')
})

test('detach: it stays exactly where it is, its height now from the floor', () => {
  const p = pedestal({ rotY: 45 })
  const o = object({ pedestalId: 'p1', offsetX: 8, offsetZ: -4, rotY: 10, lift: 2 })
  const layout = layoutOf(p, o)
  const before = placeAll(layout).find(({ item }) => item.id === 'o1')!.at
  const free = detachObject(layout, o)
  expect(free.pedestalId).toBeNull()
  const after = placeAll(layoutOf(p, free)).find(({ item }) => item.id === 'o1')!.at
  expect(after.x).toBeCloseTo(before.x)
  expect(after.z).toBeCloseTo(before.z)
  expect(after.y).toBeCloseTo(before.y)
  expect(after.rotY).toBeCloseTo(before.rotY)
})

test('resizing a pedestal keeps Objects that still fit, re-centres the others', () => {
  const p = pedestal({ w: 100, d: 100 })
  const near = object({ id: 'near', pedestalId: 'p1', offsetX: 10 })
  const far = object({ id: 'far', pedestalId: 'p1', offsetX: 45 })
  const smaller = { ...p, w: 40, d: 40 }
  const kept = keepObjectsOnTop(layoutOf(smaller, near, far), smaller)
  expect((kept.items.find((i) => i.id === 'near') as FloorObject).offsetX).toBe(10)
  expect((kept.items.find((i) => i.id === 'far') as FloorObject).offsetX).toBe(0)
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

