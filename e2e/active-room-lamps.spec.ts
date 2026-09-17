import { test, expect } from '@playwright/test'
import { litLampPredicate, roomCentre } from '../src/components/scene/spaces/objects/useActiveRoom'

// Vienna's two rooms, as `groupNodesByRoom` returns them. Room 0 owns the two
// connecting-corridor fixtures (6 and 7); everything else is room interior.
const GROUPS = [
  { room: 'room0', indices: [0, 1, 2, 3, 4, 5, 6, 7] },
  { room: 'room1', indices: [8, 9, 10, 11, 12, 13, 14, 15] },
]
const CORRIDOR = [6, 7]

test('a lamp in the active room is lit', () => {
  const lit = litLampPredicate(GROUPS, 0, [])
  expect(lit(3)).toBe(true)
})

test('a lamp in the other room is not lit', () => {
  const lit = litLampPredicate(GROUPS, 0, [])
  expect(lit(11)).toBe(false)
})

test('a corridor lamp stays lit from the room that owns it', () => {
  const lit = litLampPredicate(GROUPS, 0, CORRIDOR)
  expect(lit(6)).toBe(true)
  expect(lit(7)).toBe(true)
})

test('a corridor lamp stays lit from the room that does NOT own it', () => {
  // The bug: walking toward room 1, room 0 goes dark and takes the corridor
  // with it, so the visitor passes under an unlit fixture.
  const lit = litLampPredicate(GROUPS, 1, CORRIDOR)
  expect(lit(6)).toBe(true)
  expect(lit(7)).toBe(true)
})

test('exempting the corridor does not light the rest of the far room', () => {
  const lit = litLampPredicate(GROUPS, 1, CORRIDOR)
  expect(lit(0)).toBe(false)
  expect(lit(5)).toBe(false)
})

test('a space with one group lights every lamp', () => {
  const lit = litLampPredicate([{ room: null, indices: [0, 1, 2] }], 0, [])
  expect(lit(0)).toBe(true)
  expect(lit(2)).toBe(true)
})

// --- room centres -----------------------------------------------------------

const nodes = {
  // Room 0 interior: a tight cluster at z ≈ 0.
  l0: { position: { x: 0, y: 3, z: -2 } },
  l1: { position: { x: 0, y: 3, z: 2 } },
  // The corridor pair, far up the z axis — this is what drags the centre.
  l6: { position: { x: -5, y: 3, z: 8 } },
  l7: { position: { x: -5, y: 3, z: 12 } },
}

test('a room centre is the mean of its lamps', () => {
  const c = roomCentre([0, 1], nodes, 'l', [])
  expect(c.x).toBeCloseTo(0)
  expect(c.z).toBeCloseTo(0)
})

test('corridor lamps are excluded from the room centre', () => {
  // With the corridor counted, the centre is dragged to z = 5 — up the corridor
  // rather than in the room, which is what moves the switch point.
  expect(roomCentre([0, 1, 6, 7], nodes, 'l', []).z).toBeCloseTo(5)
  // Excluded, it stays where the room actually is.
  expect(roomCentre([0, 1, 6, 7], nodes, 'l', [6, 7]).z).toBeCloseTo(0)
})

test('a room of only corridor lamps does not collapse to the origin silently', () => {
  // Degenerate, but it must not produce NaN and poison every distance test.
  const c = roomCentre([6, 7], nodes, 'l', [6, 7])
  expect(Number.isNaN(c.x)).toBe(false)
  expect(Number.isNaN(c.z)).toBe(false)
})
