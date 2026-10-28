import { createHash } from 'node:crypto'

import { test, expect } from '@playwright/test'

import { BAKER_VERSION, isBakeRecord } from '@/lib/bake/bakeRecord'
import { LIGHT_FIELDS, computeBakeFingerprint } from '@/lib/bake/fingerprint'
import { canonicalJson } from '@/lib/bake/hash'
import { spaceLookVersion } from '@/lib/bake/spaceLookVersion'

const base = {
  exhibition: { spaceId: 'madrid', wallColor: '#ffffff', mainTitle: 'A', description: 'x' },
  placed: [
    {
      artworkId: 'a1',
      wallId: 'w1',
      posX3d: 1,
      showOnPage: true,
      pageOrder: 1,
      artwork: { artworkType: 'image', hiddenFromExhibition: false, title: 'T' },
    },
  ],
  spaceModelVersion: 'madrid.glb?v=3',
  spaceLookVersion: 'look-1',
}
const fp = (patch: (b: typeof base) => void) => {
  const b = structuredClone(base)
  patch(b)
  return computeBakeFingerprint(b)
}

test('stable and 64-hex', () => {
  expect(computeBakeFingerprint(base)).toMatch(/^[0-9a-f]{64}$/)
  expect(computeBakeFingerprint(structuredClone(base))).toBe(computeBakeFingerprint(base))
})

test('light changes stale the bake', () => {
  const f = computeBakeFingerprint(base)
  expect(
    fp((b) => {
      b.exhibition.wallColor = '#eeeeee'
    }),
  ).not.toBe(f)
  expect(
    fp((b) => {
      b.placed[0]!.posX3d = 1.1
    }),
  ).not.toBe(f)
  expect(
    fp((b) => {
      b.spaceModelVersion = 'madrid.glb?v=4'
    }),
  ).not.toBe(f)
  expect(
    fp((b) => {
      b.spaceLookVersion = 'look-2'
    }),
  ).not.toBe(f) // the space was recalibrated
})

test('artist decor stales the bake', () => {
  const f = computeBakeFingerprint(base)
  expect(
    fp((b) => {
      Object.assign(b.exhibition, { radiatorColor: '#000000' })
    }),
  ).not.toBe(f)
  expect(
    fp((b) => {
      Object.assign(b.exhibition, { windowFrameColor: '#000000' })
    }),
  ).not.toBe(f)
})

test("the artist's track beam, throw and ceiling color stale the bake", () => {
  // Eduardo 2026-10-20: the artist's again, baked like the wall color.
  const f = computeBakeFingerprint(base)
  const each = [{ trackLampAngle: 0.5 }, { trackLampDistance: 3 }, { ceilingColor: '#e8e0cd' }].map(
    (patch) => fp((b) => Object.assign(b.exhibition, patch)),
  )
  for (const changed of each) expect(changed).not.toBe(f)
  expect(new Set(each).size).toBe(3)
  // No cut-off (0) is a throw of its own, not a missing one.
  expect(fp((b) => Object.assign(b.exhibition, { trackLampDistance: 0 }))).not.toBe(f)
  expect(fp((b) => Object.assign(b.exhibition, { trackLampDistance: 0 }))).not.toBe(
    fp((b) => Object.assign(b.exhibition, { trackLampDistance: 5 })),
  )
})

test('space-owned columns do not stale the bake', () => {
  const f = computeBakeFingerprint(base)
  expect(
    fp((b) => {
      Object.assign(b.exhibition, {
        floorMaterial: 'wood-planks',
        windowLightIntensity: 9,
        ambientLightIntensity: 2,
        trackLampColor: '#ff0000',
        recessedLampAngle: 40,
      })
    }),
  ).toBe(f)
})

test('page-only changes do not stale the bake', () => {
  const f = computeBakeFingerprint(base)
  expect(
    fp((b) => {
      b.exhibition.mainTitle = 'B'
      b.exhibition.description = 'y'
    }),
  ).toBe(f)
  expect(
    fp((b) => {
      b.placed[0]!.pageOrder = 9
      b.placed[0]!.showOnPage = false
    }),
  ).toBe(f)
  expect(
    fp((b) => {
      b.placed[0]!.artwork.title = 'Other'
    }),
  ).toBe(f)
})

test('placed row order does not matter', () => {
  const two = (order: string[]) => {
    const b = structuredClone(base)
    b.placed = order.map((id) => ({ ...base.placed[0]!, artworkId: id }))
    return computeBakeFingerprint(b)
  }
  expect(two(['a1', 'a2'])).toBe(two(['a2', 'a1']))
})

test('spaceLookVersion is stable and differs per calibrated space', () => {
  expect(spaceLookVersion('paris')).toBe(spaceLookVersion('paris'))
  expect(spaceLookVersion('paris')).not.toBe(spaceLookVersion('vienna'))
  expect(spaceLookVersion('paris')).toMatch(/^[0-9a-f]{8}$/)
})

// AR-163: display panels are baked. A room that shows a panel must re-bake (its old bake has no
// panel map); a room without one keeps its fingerprint exactly, so its bake stays current.
const panels = (enabled: boolean) => ({ '0': { x: 1, z: 2, color: '#86905a', enabled } })
/** The fingerprint as it was before panels were baked. */
const before = (b: typeof base & { exhibition: Record<string, unknown> }) => {
  const exhibition: Record<string, unknown> = {}
  for (const field of LIGHT_FIELDS) exhibition[field] = b.exhibition[field] ?? null
  const placed = b.placed.map((row) => {
    const { showOnPage: _s, pageOrder: _p, artwork, ...rest } = row
    return {
      ...rest,
      artwork: {
        artworkType: artwork.artworkType,
        hiddenFromExhibition: artwork.hiddenFromExhibition,
      },
    }
  })
  return createHash('sha256')
    .update(
      canonicalJson({
        bakerVersion: BAKER_VERSION,
        spaceModelVersion: b.spaceModelVersion,
        spaceLookVersion: b.spaceLookVersion,
        exhibition,
        placed,
      }),
    )
    .digest('hex')
}

test('a room without a panel keeps its fingerprint from before panels were baked', () => {
  expect(computeBakeFingerprint(base)).toBe(before(base))
  const off = { ...base, exhibition: { ...base.exhibition, panelSettings: panels(false) } }
  expect(computeBakeFingerprint(off)).toBe(before(off))
})

test('a room that shows a panel stales its bakes from before panels were baked', () => {
  const on = { ...base, exhibition: { ...base.exhibition, panelSettings: panels(true) } }
  expect(computeBakeFingerprint(on)).not.toBe(before(on))
  // …and is otherwise as stable as any fingerprint.
  expect(computeBakeFingerprint(structuredClone(on))).toBe(computeBakeFingerprint(on))
})

// AR-167: gallery benches are baked (they shadow the floor and walls). Same contract as the panels:
// a room without a bench switched on keeps its fingerprint exactly; switching one on, moving,
// turning or swapping it stales the bake.
const benches = (patch: Record<string, unknown> = {}) => ({
  '0': { enabled: true, model: 'odes', x: 0, z: 0, rotationY: 0, ...patch },
})
const withBenches = (benchSettings: unknown) =>
  computeBakeFingerprint({ ...base, exhibition: { ...base.exhibition, benchSettings } })

test('a room without a bench keeps its fingerprint', () => {
  // In LIGHT_FIELDS an absent field hashes as null, which would stale every bake ever made.
  expect(LIGHT_FIELDS).not.toContain('benchSettings')
  const plain = computeBakeFingerprint(base)
  for (const settings of [undefined, null, {}, benches({ enabled: false })])
    expect(withBenches(settings)).toBe(plain)
})

test('a bench switched on, moved, turned or swapped stales the bake', () => {
  const prints = [
    computeBakeFingerprint(base),
    withBenches(benches()),
    withBenches(benches({ x: 1 })),
    withBenches(benches({ rotationY: 90 })),
    withBenches(benches({ model: 'black' })),
  ]
  expect(new Set(prints).size).toBe(prints.length)
  expect(withBenches(benches())).toBe(withBenches(structuredClone(benches())))
})

test('isBakeRecord accepts a panel map and a card map', () => {
  const map = {
    receiver: 'panels',
    kind: 'light',
    url: 'u',
    width: 1,
    height: 1,
    encoding: { format: 'log16', max: 1, knee: 0.5 },
  }
  const record = {
    id: 'x',
    fingerprint: 'f',
    bakerVersion: 1,
    unwrapHash: 'u',
    unwrapStats: [],
    maps: [map],
    camera: { exposure: 1, whiteBalance: [1, 1, 1] },
    artLight: {},
    bakedAt: 't',
    bakedBy: 'a',
    ms: 1,
    reviewedAt: null,
  }
  expect(isBakeRecord(record)).toBe(true)
  expect(isBakeRecord({ ...record, maps: [{ ...map, receiver: 'cards' }] })).toBe(true)
  expect(isBakeRecord({ ...record, maps: [{ ...map, receiver: 'sofa' }] })).toBe(false)
})

test('isBakeRecord rejects partial records', () => {
  expect(isBakeRecord({ id: 'x' })).toBe(false)
  expect(isBakeRecord(null)).toBe(false)
})

test('isBakeRecord accepts a complete record', () => {
  expect(
    isBakeRecord({
      id: 'x',
      fingerprint: 'f',
      bakerVersion: 1,
      unwrapHash: 'u',
      unwrapStats: [[3, 1.5, 1, 0.5, 0.375]],
      maps: [
        {
          receiver: 'wall',
          kind: 'light',
          url: 'u',
          width: 1,
          height: 1,
          encoding: { format: 'log16', max: 1, knee: 0.5 },
        },
      ],
      camera: { exposure: 1, whiteBalance: [1, 1, 1] },
      artLight: { 'artwork-1': [0.1, 0.2, 0.3] },
      bakedAt: 't',
      bakedBy: 'a',
      ms: 1,
      reviewedAt: null,
    }),
  ).toBe(true)
})

test('isBakeRecord checks the per-artwork light and the unwrap statistics', () => {
  const complete = {
    id: 'x',
    fingerprint: 'f',
    bakerVersion: 1,
    unwrapHash: 'u',
    unwrapStats: [[3, 1.5, 1, 0.5, 0.375]],
    maps: [],
    camera: { exposure: 1, whiteBalance: [1, 1, 1] },
    artLight: { 'artwork-1': [0.1, 0.2, 0.3] },
    bakedAt: 't',
    bakedBy: 'a',
    ms: 1,
    reviewedAt: null,
  }
  expect(isBakeRecord(complete)).toBe(true)
  expect(isBakeRecord({ ...complete, artLight: {} })).toBe(true)
  expect(isBakeRecord({ ...complete, unwrapStats: [] })).toBe(true)
  const { artLight: _a, ...noArtLight } = complete
  expect(isBakeRecord(noArtLight)).toBe(false)
  const { unwrapStats: _s, ...noStats } = complete
  expect(isBakeRecord(noStats)).toBe(false)
  expect(isBakeRecord({ ...complete, artLight: { a: [0.1, 0.2] } })).toBe(false)
  expect(isBakeRecord({ ...complete, artLight: { a: [0.1, 0.2, Number.NaN] } })).toBe(false)
  expect(isBakeRecord({ ...complete, artLight: [[0.1, 0.2, 0.3]] })).toBe(false)
  expect(isBakeRecord({ ...complete, unwrapStats: [[3, 1.5, 1, 0.5]] })).toBe(false)
  expect(isBakeRecord({ ...complete, unwrapStats: [[3, 1.5, 1, 0.5, Infinity]] })).toBe(false)
})
