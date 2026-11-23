import { test, expect } from '@playwright/test'

import { hangsOnWall, isArtworkKind } from '../src/lib/artwork/artworkKinds'
import { mediaLimitsFor } from '../src/lib/artwork/artworkMediaTypes'
import {
  objectDimensionsText,
  objectWriteData,
  parseObjectFields,
} from '../src/lib/artwork/objectArtwork'

// Objects (docs/objects, step O1): the pure rules the artwork routes apply to an Object's fields.
// Pure functions, no server: the routes call exactly these.

const parsed = (body: Record<string, unknown>) => {
  const result = parseObjectFields(body)
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`)
  return result.data
}

test('only the keys sent are returned; null and empty clear', () => {
  expect(parsed({ title: 'Bronze', heightCm: 64 })).toEqual({ heightCm: 64 })
  expect(parsed({ heightCm: null, careNote: '' })).toEqual({ heightCm: null, careNote: null })
  expect(parsed({})).toEqual({})
})

test('sizes land on the 0.1 cm grid and weight on 10 g; form strings are read', () => {
  expect(parsed({ heightCm: '64,46', widthCm: 38.04, depthCm: '31' })).toEqual({
    heightCm: 64.5,
    widthCm: 38,
    depthCm: 31,
  })
  expect(parsed({ weightKg: '18.234' })).toEqual({ weightKg: 18.23 })
})

test('sizes and weight must be positive numbers', () => {
  for (const body of [{ heightCm: 0 }, { widthCm: -3 }, { depthCm: 'tall' }, { weightKg: 1e9 }]) {
    expect(parseObjectFields(body).ok).toBe(false)
  }
})

test('the cover crop is clamped to 0..1', () => {
  expect(parsed({ coverCropX: 1.02, coverCropY: -0.1 })).toEqual({ coverCropX: 1, coverCropY: 0 })
})

test('choices accept only their values', () => {
  expect(parsed({ placement: 'both', displayMode: 'pedestal' })).toEqual({
    placement: 'both',
    displayMode: 'pedestal',
  })
  expect(parseObjectFields({ placement: 'garden' }).ok).toBe(false)
  expect(parseObjectFields({ displayMode: 'shelf' }).ok).toBe(false)
  expect(parseObjectFields({ objectEdition: 'limited' }).ok).toBe(false)
})

test('an edition is number N of M plus proofs; N never above M', () => {
  expect(
    parsed({
      objectEdition: 'edition',
      objectEditionNo: 3,
      objectEditionOf: '8',
      objectArtistProofs: 2,
    }),
  ).toEqual({
    objectEdition: 'edition',
    objectEditionNo: 3,
    objectEditionOf: 8,
    objectArtistProofs: 2,
  })
  expect(parseObjectFields({ objectEditionNo: 9, objectEditionOf: 8 }).ok).toBe(false)
  expect(parseObjectFields({ objectEditionNo: 2.5 }).ok).toBe(false)
  expect(parseObjectFields({ objectEditionNo: 0 }).ok).toBe(false)
})

test('"unique" clears the edition numbers', () => {
  expect(parsed({ objectEdition: 'unique', objectEditionNo: 3, objectEditionOf: 8 })).toEqual({
    objectEdition: 'unique',
    objectEditionNo: null,
    objectEditionOf: null,
    objectArtistProofs: null,
  })
})

test('notes: one line for signed / certificate, lines kept for care, length capped', () => {
  expect(parsed({ signedNote: 'Signed\non the base', careNote: 'Dust only.\nNo water.' })).toEqual({
    signedNote: 'Signed on the base',
    careNote: 'Dust only.\nNo water.',
  })
  expect(parseObjectFields({ certificateNote: 'x'.repeat(301) }).ok).toBe(false)
  expect(parseObjectFields({ careNote: 42 }).ok).toBe(false)
})

test('the 3D model fields are never taken from a request', () => {
  expect(parsed({ modelUrl: 'https://elsewhere/x.glb', modelStatus: 'ready' })).toEqual({})
})

test('legacy dimensions text: H × W × D in cm, whole numbers bare', () => {
  expect(objectDimensionsText({ heightCm: 64, widthCm: 38, depthCm: 31 })).toBe('64 × 38 × 31 cm')
  expect(objectDimensionsText({ heightCm: 64.5, widthCm: 38, depthCm: null })).toBe('64.5 × 38 cm')
  expect(objectDimensionsText({})).toBeNull()
})

test('write data: print sales always off; dimensions rebuilt from the stored size', () => {
  const stored = { heightCm: 64, widthCm: 38, depthCm: 31 }
  expect(objectWriteData({ depthCm: 40 }, stored)).toEqual({
    depthCm: 40,
    printEnabled: false,
    printPriceCents: null,
    editionType: 'open',
    dimensions: '64 × 38 × 40 cm',
  })
  // No size sent: the text is left as it is.
  expect(objectWriteData({ weightKg: 18 }, stored)).not.toHaveProperty('dimensions')
})

test('kinds: object is known and never hangs on a wall', () => {
  expect(isArtworkKind('object')).toBe(true)
  expect(isArtworkKind('sculpture')).toBe(false)
  expect(hangsOnWall('object')).toBe(false)
  expect(hangsOnWall('image')).toBe(true)
})

test('media limits per type: Objects 40 photos / 6 videos, the rest 60 / 2', () => {
  expect(mediaLimitsFor('object')).toEqual({ maxItems: 46, maxImages: 40, maxVideos: 6 })
  expect(mediaLimitsFor('image')).toEqual({ maxItems: 60, maxImages: 60, maxVideos: 2 })
})
