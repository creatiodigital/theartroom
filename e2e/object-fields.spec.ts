import { test, expect } from '@playwright/test'

import { hangsOnWall, isArtworkKind } from '../src/lib/artwork/artworkKinds'
import { mediaLimitsFor } from '../src/lib/artwork/artworkMediaTypes'
import { formatObjectSize, formatWeight } from '../src/lib/units/format'
import {
  countObjectMedia,
  objectDimensionsText,
  objectMediaSummary,
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
  expect(parsed({ heightCm: null, weightKg: '' })).toEqual({ heightCm: null, weightKg: null })
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

test('no edition: an Object is always a unique piece, so edition fields are never written', () => {
  expect(
    parsed({
      objectEdition: 'edition',
      objectEditionNo: 3,
      objectEditionOf: '8',
      objectArtistProofs: 2,
    }),
  ).toEqual({})
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

test('media counts: images are photos; vertical or Reel-labelled videos are reels', () => {
  expect(
    countObjectMedia([
      { kind: 'image', role: 'front' },
      { kind: 'image', role: null },
      { kind: 'video', role: null, width: 1080, height: 1920 },
      { kind: 'video', role: 'reel', width: null, height: null },
      { kind: 'video', role: 'process', width: 1920, height: 1080 },
      { kind: 'audio' },
    ]),
  ).toEqual({ photos: 2, reels: 2, videos: 1 })
})

test('media summary reads as on the board', () => {
  expect(objectMediaSummary({ photos: 8, reels: 2, videos: 0 })).toBe('8 photos · 2 reels')
  expect(objectMediaSummary({ photos: 5, reels: 0, videos: 1 })).toBe('5 photos · 1 video')
  expect(objectMediaSummary({ photos: 1, reels: 1, videos: 2 })).toBe('1 photo · 1 reel · 2 videos')
  expect(objectMediaSummary({ photos: 0, reels: 0, videos: 0 })).toBeNull()
})

test('visitor size (Q-O9): cm as entered, inches one decimal; weight always kg', () => {
  const size = { heightCm: 64, widthCm: 38, depthCm: 31 }
  expect(formatObjectSize(size, 'cm')).toBe('64 × 38 × 31 cm')
  expect(formatObjectSize({ ...size, heightCm: 64.5 }, 'cm')).toBe('64.5 × 38 × 31 cm')
  expect(formatObjectSize(size, 'in')).toBe('25.2 × 15.0 × 12.2 in')
  expect(formatObjectSize({ heightCm: 64 }, 'cm')).toBe('64 cm')
  expect(formatObjectSize({}, 'cm')).toBeNull()
  expect(formatWeight(18)).toBe('18 kg')
  expect(formatWeight(2.54)).toBe('2.5 kg')
})

test('no technical info: placement, display and notes are never written', () => {
  expect(
    parsed({
      placement: 'both',
      displayMode: 'pedestal',
      signedNote: 'Signed on the base',
      certificateNote: 'Yes',
      careNote: 'Dust only.',
    }),
  ).toEqual({})
})
