import { test, expect } from '@playwright/test'

import { isBakeRecord } from '@/lib/bake/bakeRecord'
import { computeBakeFingerprint } from '@/lib/bake/fingerprint'
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
