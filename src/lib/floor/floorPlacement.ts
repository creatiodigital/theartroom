/**
 * Where everything on a floor really is (docs/objects O6 "Snapping, exactly"; floor composing,
 * docs/superpowers/specs/2026-11-25-floor-attach-any-side-design.md). Pure: the plan, the Inspector,
 * the editor, the live 3D, the visitors' room and the bake all read the same answer.
 *
 * Every item is a box (a pedestal's w × h × d, an Object's model size × its scale), turned about its
 * centre (Euler 'YXZ').
 * - Free: its centre over (x, z), its lowest point `lift` cm above the floor, so a tilt never sinks it.
 * - Attached to a face of its parent's box: turned as the parent × its rest on that face (on a side:
 *   its back against it, facing out) × its own turn; its centre at the face's centre moved by the
 *   offsets in the face's plane, pushed out along the face's normal until it touches (+ `lift`).
 * Chains resolve through their parents, so moving or turning the root carries everything on it.
 */
import { Box3, Euler, Quaternion, Ray, Vector3 } from 'three'

import type { FloorSizes } from './floorArtworks'
import {
  isSideFace,
  type FloorFace,
  type FloorItem,
  type FloorLayout,
  type FloorPedestal,
} from './floorLayout'
import { insideOutline, pedestalOutline, pedestalTop } from './pedestals'

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

/** An Object whose model size is unknown counts as a 40 cm cube (as its plan footprint always did). */
export const FALLBACK_CM = 40

/** cm: width (x), height (y), depth (z). */
export type Size = { w: number; h: number; d: number }

export type Placed = {
  /** World metres: the box's centre over the floor. */
  x: number
  z: number
  /** The box's lowest point above the floor, metres (an upright item's base). */
  y: number
  /** The box centre's height above the floor, metres. */
  cy: number
  /** World degrees: the way its front faces, seen from above. */
  rotY: number
  quaternion: Quaternion
  /** World bounds, metres (y from the floor). */
  min: Vector3
  max: Vector3
  size: Size
  /** Not tilted: its up is the room's up. */
  upright: boolean
}

export function itemSize(item: FloorItem, sizes: FloorSizes): Size {
  if (item.kind === 'pedestal') return { w: item.w, h: item.h, d: item.d }
  const b = sizes[item.artworkId]
  const k = item.scale
  return {
    w: (b?.w || FALLBACK_CM) * k,
    h: (b?.h || FALLBACK_CM) * k,
    d: (b?.d || FALLBACK_CM) * k,
  }
}

const UP = new Vector3(0, 1, 0)
const AXES = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)] as const

const FACE_NORMAL: Record<FloorFace, [number, number, number]> = {
  top: [0, 1, 0],
  bottom: [0, -1, 0],
  front: [0, 0, 1],
  back: [0, 0, -1],
  right: [1, 0, 0],
  left: [-1, 0, 0],
}

/** On a side its back is against the face, so it faces out; on a top or bottom it stays upright. */
const REST_TURN: Record<FloorFace, number> = {
  top: 0,
  bottom: 0,
  front: 0,
  back: 180,
  right: 90,
  left: -90,
}

/** Half sizes in metres, along the item's own x, y, z. */
const halfOf = (s: Size) => [s.w / 200, s.h / 200, s.d / 200] as const

/** How far a turned box reaches from its centre along a direction. */
const extent = (q: Quaternion, half: readonly number[], n: Vector3) =>
  AXES.reduce((sum, axis, k) => sum + Math.abs(axis.clone().applyQuaternion(q).dot(n)) * half[k], 0)

/** Degrees in [−180, 180). */
const norm = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180

// `+ 0`: never −0.
const tidy = (v: number) => Math.round(v * 1e4) / 1e4 + 0

export const ownTurn = (i: Pick<FloorItem, 'rotX' | 'rotY' | 'rotZ'>) =>
  new Quaternion().setFromEuler(new Euler(i.rotX * RAD, i.rotY * RAD, i.rotZ * RAD, 'YXZ'))

const restOf = (face: FloorFace) => new Quaternion().setFromAxisAngle(UP, REST_TURN[face] * RAD)

/** The way a turned box's front faces, seen from above (its right side, when its front is vertical). */
function headingOf(q: Quaternion) {
  const front = new Vector3(0, 0, 1).applyQuaternion(q)
  if (Math.hypot(front.x, front.z) > 1e-6) return norm(Math.atan2(front.x, front.z) * DEG)
  const right = new Vector3(1, 0, 0).applyQuaternion(q)
  return norm(Math.atan2(right.x, right.z) * DEG - 90)
}

/** A turn as the fields store it (degrees, 'YXZ'). */
export function worldTurns(q: Quaternion) {
  const e = new Euler().setFromQuaternion(q, 'YXZ')
  return { rotX: tidy(e.x * DEG), rotY: tidy(e.y * DEG), rotZ: tidy(e.z * DEG) }
}

function finish(centre: Vector3, q: Quaternion, size: Size): Placed {
  const [hx, hy, hz] = halfOf(size)
  const min = new Vector3(Infinity, Infinity, Infinity)
  const max = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const p = new Vector3(sx * hx, sy * hy, sz * hz).applyQuaternion(q).add(centre)
        min.min(p)
        max.max(p)
      }
  return {
    x: centre.x,
    z: centre.z,
    y: min.y,
    cy: centre.y,
    rotY: headingOf(q),
    quaternion: q,
    min,
    max,
    size,
    upright: UP.clone().applyQuaternion(q).y > 1 - 1e-6,
  }
}

function freePlace(item: FloorItem, size: Size): Placed {
  const q = ownTurn(item)
  const centre = new Vector3(item.x, item.lift / 100 + extent(q, halfOf(size), UP), item.z)
  return finish(centre, q, size)
}

/** The face's normal, its centre and the offsets' axes in the parent's own frame (metres). */
function faceLocal(parent: Placed, face: FloorFace) {
  const n = new Vector3(...FACE_NORMAL[face])
  const [hx, hy, hz] = halfOf(parent.size)
  const centre = new Vector3(n.x * hx, n.y * hy, n.z * hz)
  // On a side: across = to the right looking at the face from outside, up = the parent's up.
  // On a top or bottom: the parent's own x and z.
  const across = isSideFace(face) ? UP.clone().cross(n) : AXES[0].clone()
  const up = isSideFace(face) ? UP.clone() : AXES[2].clone()
  return { n, centre, across, up }
}

const parentCentre = (p: Placed) => new Vector3(p.x, p.cy, p.z)

function attachedPlace(item: FloorItem, parent: Placed, size: Size): Placed {
  const local = faceLocal(parent, item.face)
  const q = parent.quaternion.clone().multiply(restOf(item.face)).multiply(ownTurn(item))
  const n = local.n.clone().applyQuaternion(parent.quaternion)
  const offset = isSideFace(item.face)
    ? local.across.multiplyScalar(item.offsetX / 100).add(UP.clone().multiplyScalar(item.offsetY / 100))
    : new Vector3(item.offsetX / 100, 0, item.offsetZ / 100)
  const centre = parentCentre(parent)
    .add(local.centre.add(offset).applyQuaternion(parent.quaternion))
    .add(n.clone().multiplyScalar(extent(q, halfOf(size), n) + item.lift / 100))
  return finish(centre, q, size)
}

/** Every item with where it is, by id. Roots first, children through their parents. */
export function placeMap(layout: FloorLayout, sizes: FloorSizes): Map<string, Placed> {
  const byId = new Map(layout.items.map((i) => [i.id, i]))
  const out = new Map<string, Placed>()
  const visiting = new Set<string>()
  const place = (item: FloorItem): Placed => {
    const done = out.get(item.id)
    if (done) return done
    visiting.add(item.id)
    const parent = item.parentId ? byId.get(item.parentId) : undefined
    // A parent that is gone, elsewhere or in a loop: free where it was last placed (as parse does).
    const on =
      parent && parent.room === item.room && !visiting.has(parent.id) ? place(parent) : null
    const size = itemSize(item, sizes)
    const at = on ? attachedPlace(item, on, size) : freePlace(item, size)
    visiting.delete(item.id)
    out.set(item.id, at)
    return at
  }
  for (const item of layout.items) place(item)
  return out
}

/** Every item with where it is, in the layout's order. */
export function placeAll(layout: FloorLayout, sizes: FloorSizes): { item: FloorItem; at: Placed }[] {
  const at = placeMap(layout, sizes)
  return layout.items.map((item) => ({ item, at: at.get(item.id)! }))
}

export const childrenOf = (layout: FloorLayout, id: string) =>
  layout.items.filter((i) => i.parentId === id)

/** Everything attached to it, at any depth. */
export function descendantsOf(layout: FloorLayout, id: string): Set<string> {
  const out = new Set<string>()
  const queue = [id]
  while (queue.length) {
    const at = queue.pop()!
    for (const c of layout.items) {
      if (c.parentId === at && !out.has(c.id) && c.id !== id) {
        out.add(c.id)
        queue.push(c.id)
      }
    }
  }
  return out
}

/** What a drag of these items moves: them and everything attached to them, at any depth. */
export const movingWith = (layout: FloorLayout, ids: string[]): Set<string> =>
  new Set(ids.flatMap((id) => [id, ...descendantsOf(layout, id)]))

/** A face in the world: its centre, outward normal, the offsets' axes (unit) and its size (m). */
export function faceFrame(parent: Placed, face: FloorFace) {
  const local = faceLocal(parent, face)
  const q = parent.quaternion
  const [w, h, d] = [parent.size.w / 100, parent.size.h / 100, parent.size.d / 100]
  return {
    centre: parentCentre(parent).add(local.centre.applyQuaternion(q)),
    normal: local.n.applyQuaternion(q),
    across: local.across.applyQuaternion(q),
    up: local.up.applyQuaternion(q),
    width: face === 'left' || face === 'right' ? d : w,
    height: isSideFace(face) ? h : d,
  }
}

/**
 * An attached item moved on the plan by (dx, dz) metres: the move seen along its face's own axes,
 * so it slides on the face (on a side only across it: its height stays).
 */
export function slideOnFace<T extends FloorItem>(item: T, parent: Placed, dx: number, dz: number): T {
  const f = faceFrame(parent, item.face)
  const along = (v: Vector3) => (dx * v.x + dz * v.z) * 100
  return isSideFace(item.face)
    ? { ...item, offsetX: item.offsetX + along(f.across) }
    : { ...item, offsetX: item.offsetX + along(f.across), offsetZ: item.offsetZ + along(f.up) }
}

type Point = { x: number; y: number; z: number }

/**
 * The live 3D's drag (floor composing): the nearest item's face a ray meets (world m, y from the
 * floor), in the room, never one in `exclude` (the dragged item and what is attached to it).
 */
export function faceUnderRay(
  layout: FloorLayout,
  sizes: FloorSizes,
  ray: { origin: Point; direction: Point },
  room: number,
  exclude: Set<string>,
): { id: string; face: FloorFace; point: Vector3 } | null {
  const places = placeMap(layout, sizes)
  let best: { id: string; face: FloorFace; point: Vector3; t: number } | null = null
  for (const item of layout.items) {
    if (item.room !== room || exclude.has(item.id)) continue
    const at = places.get(item.id)!
    const toLocal = at.quaternion.clone().invert()
    const centre = new Vector3(at.x, at.cy, at.z)
    const local = new Ray(
      new Vector3(ray.origin.x, ray.origin.y, ray.origin.z).sub(centre).applyQuaternion(toLocal),
      new Vector3(ray.direction.x, ray.direction.y, ray.direction.z).normalize().applyQuaternion(toLocal),
    )
    const half = halfOf(at.size)
    const hit = local.intersectBox(
      new Box3(new Vector3(-half[0], -half[1], -half[2]), new Vector3(...half)),
      new Vector3(),
    )
    if (!hit) continue
    const t = hit.distanceTo(local.origin)
    if (best && t >= best.t) continue
    // The face: the axis the hit is furthest out on, for its size.
    const r = [hit.x / half[0], hit.y / half[1], hit.z / half[2]]
    const k = [0, 1, 2].reduce((m, i) => (Math.abs(r[i]) > Math.abs(r[m]) ? i : m), 0)
    const face: FloorFace =
      k === 0 ? (r[0] > 0 ? 'right' : 'left') : k === 1 ? (r[1] > 0 ? 'top' : 'bottom') : r[2] > 0 ? 'front' : 'back'
    best = { id: item.id, face, point: hit.applyQuaternion(at.quaternion).add(centre), t }
  }
  return best && { id: best.id, face: best.face, point: best.point }
}

/** A world point (m) in an upright item's own plan frame (cm from its centre). */
export function toItemFrame(at: Placed, x: number, z: number): [number, number] {
  return rotateOffset((x - at.x) * 100, (z - at.z) * 100, -at.rotY)
}

/** Rotate a plan offset (cm) by degrees, around the vertical, as three.js does for +y rotation. */
export function rotateOffset(x: number, z: number, deg: number): [number, number] {
  const a = deg * RAD
  return [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)]
}

/** The layout with this version of the item (replacing its saved one, or added). */
const withItem = (layout: FloorLayout, item: FloorItem): FloorLayout =>
  layout.items.some((i) => i.id === item.id)
    ? { ...layout, items: layout.items.map((i) => (i.id === item.id ? item : i)) }
    : { ...layout, items: [...layout.items, item] }

/** Its x / z follow where it is now (so the free fallback is close). */
function current<T extends FloorItem>(layout: FloorLayout, item: T, sizes: FloorSizes): T {
  const at = placeMap(withItem(layout, item), sizes).get(item.id)!
  return { ...item, x: at.x, z: at.z }
}

/**
 * Attach an item to a face of another, its centre at `point` on that face (world m; null: the
 * face's centre, or where it was when it only changes nothing but its gap). On the same face it
 * keeps its turns, offsets and gap; on a new side it starts facing out (turns 0); on a new top or
 * bottom it keeps the turn about the vertical it was seen with (as O6 did). Never onto itself or
 * onto what is attached to it.
 */
export function attachTo<T extends FloorItem>(
  layout: FloorLayout,
  item: T,
  parentId: string,
  face: FloorFace,
  point: { x: number; y: number; z: number } | null,
  sizes: FloorSizes,
): T {
  if (parentId === item.id || descendantsOf(layout, item.id).has(parentId)) return item
  const all = withItem(layout, item)
  const places = placeMap(all, sizes)
  const parent = all.items.find((i) => i.id === parentId)
  const p = places.get(parentId)
  if (!parent || !p) return item
  const same = item.parentId === parentId && item.face === face
  const seen = places.get(item.id)!
  const turns = same
    ? { rotX: item.rotX, rotY: item.rotY, rotZ: item.rotZ }
    : isSideFace(face)
      ? { rotX: 0, rotY: 0, rotZ: 0 }
      : { rotX: item.rotX, rotY: tidy(norm(seen.rotY - p.rotY)), rotZ: item.rotZ }
  let offsets = same
    ? { offsetX: item.offsetX, offsetY: item.offsetY, offsetZ: item.offsetZ }
    : { offsetX: 0, offsetY: 0, offsetZ: 0 }
  if (point) {
    const local = faceLocal(p, face)
    const v = new Vector3(point.x, point.y, point.z)
      .sub(parentCentre(p))
      .applyQuaternion(p.quaternion.clone().invert())
      .sub(local.centre)
    const cm = (m: number) => Math.round(m * 1000) / 10 + 0
    offsets = isSideFace(face)
      ? { offsetX: cm(v.dot(local.across)), offsetY: cm(v.dot(UP)), offsetZ: 0 }
      : { offsetX: cm(v.x), offsetY: 0, offsetZ: cm(v.z) }
  }
  return current(
    layout,
    {
      ...item,
      ...turns,
      ...offsets,
      room: parent.room,
      parentId,
      face,
      lift: same ? item.lift : 0,
    },
    sizes,
  )
}

/** Detach: it stays exactly where it is, free (its height now from the floor); its own children stay on it. */
export function detachItem<T extends FloorItem>(layout: FloorLayout, item: T, sizes: FloorSizes): T {
  if (!item.parentId) return item
  const at = placeMap(withItem(layout, item), sizes).get(item.id)!
  return {
    ...item,
    ...worldTurns(at.quaternion),
    x: at.x,
    z: at.z,
    lift: Math.max(0, tidy(at.y * 100)),
    parentId: null,
    face: 'top',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
  }
}

/**
 * The support whose top a point (world m) is over, in the room: the highest top wins where tops
 * overlap. Upright supports only; never one in `exclude` (the dragged item and what is on it).
 */
export function supportUnder(
  layout: FloorLayout,
  sizes: FloorSizes,
  room: number,
  x: number,
  z: number,
  exclude: Set<string>,
): FloorPedestal | null {
  const places = placeMap(layout, sizes)
  let best: { p: FloorPedestal; top: number } | null = null
  for (const item of layout.items) {
    if (item.kind !== 'pedestal' || item.room !== room || exclude.has(item.id)) continue
    const at = places.get(item.id)!
    if (!at.upright) continue
    const [lx, lz] = toItemFrame(at, x, z)
    if (!insideOutline(pedestalTop(item.shape, item.w, item.d, item.h).outline, lx, lz)) continue
    if (!best || at.max.y > best.top) best = { p: item, top: at.max.y }
  }
  return best?.p ?? null
}

/** Off the floor: raised, or held by something (its lowest point more than 1 cm up). */
const OFF_FLOOR_M = 0.01

/**
 * A side of an item OFF the floor that an item dropped at (x, z) would rest against: its back (as it
 * will face out) within `tolCm` of the face, from outside, its centre across the face. The nearest wins.
 */
export function sideAgainst(
  layout: FloorLayout,
  sizes: FloorSizes,
  item: FloorItem,
  x: number,
  z: number,
  tolCm: number,
  exclude: Set<string>,
): { parent: FloorItem; face: FloorFace; across: number } | null {
  const places = placeMap(layout, sizes)
  const back = itemSize(item, sizes).d / 200
  const tol = tolCm / 100
  let best: { parent: FloorItem; face: FloorFace; across: number; gap: number } | null = null
  for (const cand of layout.items) {
    if (cand.room !== item.room || exclude.has(cand.id)) continue
    const at = places.get(cand.id)!
    if (!at.upright || at.y <= OFF_FLOOR_M) continue
    const [lx, lz] = toItemFrame(at, x, z).map((cm) => cm / 100)
    const hw = at.size.w / 200
    const hd = at.size.d / 200
    const sides: { face: FloorFace; out: number; across: number; span: number }[] = [
      { face: 'front', out: lz - hd, across: lx, span: hw },
      { face: 'back', out: -lz - hd, across: -lx, span: hw },
      { face: 'right', out: lx - hw, across: -lz, span: hd },
      { face: 'left', out: -lx - hw, across: lz, span: hd },
    ]
    for (const s of sides) {
      const gap = Math.abs(s.out - back)
      if (s.out <= 0 || gap > tol || Math.abs(s.across) > s.span) continue
      if (!best || gap < best.gap) best = { parent: cand, face: s.face, across: s.across, gap }
    }
  }
  return best && { parent: best.parent, face: best.face, across: best.across }
}

/**
 * A plan drop (docs: "Builder check: calls made" 1): only Objects attach, onto the highest support
 * top under (x, z) (centred the first time, then where it was dragged to), else against the side of
 * an item off the floor (`sideTolCm`), at that face's middle, raised if it would end below the
 * floor. Otherwise free at (x, z), as seen; off a top it lands on the floor. `snap` false (Alt)
 * never attaches. `item` is the item as it was before the drag.
 */
export function dropItem<T extends FloorItem>(
  layout: FloorLayout,
  item: T,
  x: number,
  z: number,
  sizes: FloorSizes,
  {
    snap = true,
    centre = false,
    sideTolCm = 0,
  }: { snap?: boolean; centre?: boolean; sideTolCm?: number } = {},
): T {
  const all = withItem(layout, item)
  const exclude = new Set([item.id, ...descendantsOf(all, item.id)])
  if (snap && item.kind === 'object') {
    const top = supportUnder(all, sizes, item.room, x, z, exclude)
    if (top) {
      const slide = !centre && item.parentId === top.id && item.face === 'top'
      const p = placeMap(all, sizes).get(top.id)!
      return attachTo(all, item, top.id, 'top', slide ? { x, y: p.max.y, z } : null, sizes)
    }
    const side = sideTolCm > 0 ? sideAgainst(all, sizes, item, x, z, sideTolCm, exclude) : null
    if (side) {
      const p = placeMap(all, sizes).get(side.parent.id)!
      const f = faceFrame(p, side.face)
      const point = f.centre.add(f.across.multiplyScalar(side.across))
      const on = attachTo(all, { ...item, parentId: null }, side.parent.id, side.face, point, sizes)
      const low = placeMap(withItem(all, on), sizes).get(on.id)!.y
      return low < 0 ? { ...on, offsetY: Math.ceil(on.offsetY * 10 - low * 1000) / 10 } : on
    }
  }
  if (!item.parentId) return { ...item, x, z }
  // An Object off a top lands on the floor (as O6); anything else keeps the height it was seen at.
  const free = detachItem(all, item, sizes)
  return { ...free, x, z, lift: item.kind === 'object' && item.face === 'top' ? 0 : free.lift }
}

/** None of these items moved or changed what it is on between two layouts (a click, not a drag). */
export function sameSpots(before: FloorLayout, after: FloorLayout, ids: string[]): boolean {
  const key = (i: FloorItem | undefined) =>
    i && [i.x, i.z, i.lift, i.parentId, i.face, i.offsetX, i.offsetY, i.offsetZ].join('|')
  return ids.every(
    (id) =>
      key(before.items.find((i) => i.id === id)) === key(after.items.find((i) => i.id === id)),
  )
}

/**
 * Where an Object's model sits in its placed (and scaled) group: its own box centred on the
 * placed centre; with no measured size (the 40 cm fallback), its bottom on the placed box's
 * bottom, so it never sinks into what it stands on. Model units (before the group's scale).
 */
export function modelOffset(
  box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
  at: Placed,
  scale: number,
  measured: boolean,
): [number, number, number] {
  const x = -(box.min.x + box.max.x) / 2
  const z = -(box.min.z + box.max.z) / 2
  const y = measured ? -(box.min.y + box.max.y) / 2 : -box.min.y - at.size.h / 200 / scale
  return [x, y, z]
}

/** A resized parent: its children keep their offsets, and any whose centre left its face is centred. */
export function keepChildrenOnFaces(
  layout: FloorLayout,
  parentId: string,
  sizes: FloorSizes,
): FloorLayout {
  const parent = layout.items.find((i) => i.id === parentId)
  if (!parent) return layout
  const s = itemSize(parent, sizes)
  const fits = (c: FloorItem) => {
    if (c.face === 'top' || c.face === 'bottom') {
      if (parent.kind === 'pedestal') {
        const outline =
          c.face === 'top'
            ? pedestalTop(parent.shape, parent.w, parent.d, parent.h).outline
            : pedestalOutline(parent.shape, parent.w, parent.d)
        return insideOutline(outline, c.offsetX, c.offsetZ)
      }
      return Math.abs(c.offsetX) <= s.w / 2 && Math.abs(c.offsetZ) <= s.d / 2
    }
    const width = c.face === 'left' || c.face === 'right' ? s.d : s.w
    return Math.abs(c.offsetX) <= width / 2 && Math.abs(c.offsetY) <= s.h / 2
  }
  return {
    ...layout,
    items: layout.items.map((c) =>
      c.parentId === parentId && !fits(c) ? { ...c, offsetX: 0, offsetY: 0, offsetZ: 0 } : c,
    ),
  }
}

/**
 * An attached item reaching past its face's edges (allowed; the amber outline warns). Its turned
 * box, seen on the face: a pedestal's top by its real outline, any other face by its rectangle.
 */
export function overhangs(layout: FloorLayout, item: FloorItem, sizes: FloorSizes): boolean {
  if (!item.parentId) return false
  const parent = layout.items.find((i) => i.id === item.parentId)
  const places = placeMap(layout, sizes)
  const p = places.get(item.parentId)
  const at = places.get(item.id)
  if (!parent || !p || !at) return false
  const toParent = p.quaternion.clone().invert()
  const [hx, hy, hz] = halfOf(at.size)
  const pc = parentCentre(p)
  const ph = halfOf(p.size).map((m) => m * 100)
  const EPS = 0.05
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const c = new Vector3(sx * hx, sy * hy, sz * hz)
          .applyQuaternion(at.quaternion)
          .add(new Vector3(at.x, at.cy, at.z))
          .sub(pc)
          .applyQuaternion(toParent)
          .multiplyScalar(100)
        if (item.face === 'top' && parent.kind === 'pedestal') {
          const top = pedestalTop(parent.shape, parent.w, parent.d, parent.h).outline
          if (!insideOutline(top, c.x, c.z)) return true
          continue
        }
        const [a, b, ha, hb] =
          item.face === 'top' || item.face === 'bottom'
            ? [c.x, c.z, ph[0], ph[2]]
            : item.face === 'left' || item.face === 'right'
              ? [c.z, c.y, ph[2], ph[1]]
              : [c.x, c.y, ph[0], ph[1]]
        if (Math.abs(a) > ha + EPS || Math.abs(b) > hb + EPS) return true
      }
  return false
}

/** Some part of it is under the floor (the amber outline; never clamped silently). */
export const belowFloor = (at: Placed) => at.y < -0.005

/**
 * Its outline on the plan (world cm): an upright pedestal's own shape or an Object's footprint,
 * turned; a tilted item's box seen from above (the hull of its corners).
 */
export function planOutline(item: FloorItem, at: Placed): [number, number][] {
  if (at.upright) {
    const local =
      item.kind === 'pedestal'
        ? pedestalOutline(item.shape, item.w, item.d)
        : pedestalOutline('box', at.size.w, at.size.d)
    return local.map(([lx, lz]) => {
      const [dx, dz] = rotateOffset(lx, lz, at.rotY)
      return [at.x * 100 + dx, at.z * 100 + dz]
    })
  }
  const [hx, hy, hz] = halfOf(at.size)
  const pts: [number, number][] = []
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const p = new Vector3(sx * hx, sy * hy, sz * hz).applyQuaternion(at.quaternion)
        pts.push([(at.x + p.x) * 100, (at.z + p.z) * 100])
      }
  return hull(pts)
}

/** Convex hull (monotone chain), counter-clockwise. */
function hull(points: [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: [number, number][] = []
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0)
      lower.pop()
    lower.push(pt)
  }
  const upper: [number, number][] = []
  for (const pt of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0)
      upper.pop()
    upper.push(pt)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/**
 * Remove items: what was attached to them stays where it is, free (and what is attached to that
 * stays on it); groups keep only members that are left.
 */
export function removeItems(layout: FloorLayout, ids: Set<string>, sizes: FloorSizes): FloorLayout {
  const items = layout.items
    .filter((i) => !ids.has(i.id))
    .map((i) => (i.parentId && ids.has(i.parentId) ? detachItem(layout, i, sizes) : i))
  const left = new Set(items.map((i) => i.id))
  return {
    ...layout,
    items,
    groups: layout.groups
      .map((g) => ({ ...g, memberIds: g.memberIds.filter((m) => left.has(m)) }))
      .filter((g) => g.memberIds.length >= 2),
  }
}
