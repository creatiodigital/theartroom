import { test, expect } from '@playwright/test'

import { nearFieldReceivers } from '../src/components/scene/bake/LightBaker'

// ---------------------------------------------------------------------------
// The glow behind every text card (AR-164, found 2026-10-22)
//
// The near-field pass gives back the light two close surfaces exchange: each
// texel fires short rays and adds the baked light of what they hit, reading the
// hit's lightmap whichever side the ray struck. Since AR-163 the text cards are
// baked — one sheet a few millimetres off the wall, front and back sharing
// texels — so the wall behind a card read its lit FRONT through its back and
// glowed, a centimetre or two past every edge once filtered.
//
// The invariant: a card only blocks near-field rays, like a frame. Its own light
// stays baked, and its front still bounces into the room (the VPLs, one-sided).
// ---------------------------------------------------------------------------

// The receivers in the order `prepareReceivers` builds them.
const ROOM = [
  { name: 'wall' },
  { name: 'ceiling' },
  { name: 'floor' },
  { name: 'art', noLampDirect: true },
  { name: 'props' },
  { name: 'panels' },
  { name: 'cards' },
]

const names = (receivers: { name: string }[]) => receivers.map((r) => r.name)

test('a text card never lights the wall behind it up close', () => {
  expect(names(nearFieldReceivers(ROOM))).not.toContain('cards')
})

test("the room's own surfaces still light each other up close", () => {
  expect(names(nearFieldReceivers(ROOM))).toEqual(['wall', 'ceiling', 'floor', 'props', 'panels'])
})

test('a room without panels reads the same surfaces, minus the panels', () => {
  const room = ROOM.filter((r) => r.name !== 'panels')
  expect(names(nearFieldReceivers(room))).toEqual(['wall', 'ceiling', 'floor', 'props'])
})
