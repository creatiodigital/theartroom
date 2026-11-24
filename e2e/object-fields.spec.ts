import { test, expect } from '@playwright/test'

import { hangsOnWall, isArtworkKind } from '../src/lib/artwork/artworkKinds'
import { mediaLimitsFor } from '../src/lib/artwork/artworkMediaTypes'
import { formatObjectSize, formatWeight } from '../src/lib/units/format'
import {
  countObjectMedia,
  objectCardOf,
  objectEditionLine,
  coverObjectPosition,
  coverSquare,
  objectEditionText,
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

test('no edition at all clears the numbers too', () => {
  expect(parsed({ objectEdition: '', objectEditionNo: '3', objectEditionOf: '8' })).toEqual({
    objectEdition: null,
    objectEditionNo: null,
    objectEditionOf: null,
    objectArtistProofs: null,
  })
})

test('edition text, as the editor shows it', () => {
  const t = (o: Record<string, unknown>) => objectEditionText(o)
  expect(
    t({ objectEdition: 'edition', objectEditionNo: 3, objectEditionOf: 8, objectArtistProofs: 2 }),
  ).toBe('Edition 3/8 + 2 AP')
  expect(t({ objectEdition: 'edition', objectEditionOf: 8 })).toBe('Edition of 8')
  expect(t({ objectEdition: 'unique' })).toBe('Unique piece')
  expect(t({ objectEdition: 'edition' })).toBeNull()
  expect(t({})).toBeNull()
})

test('cover crop: centre to CSS position, clamped inside the photo', () => {
  // Portrait 4000 × 5000: the square is 4000 tall, so it moves vertically only.
  const size = { width: 4000, height: 5000 }
  expect(coverObjectPosition({ x: 0.5, y: 0.5 }, size)).toBe('50% 50%')
  expect(coverObjectPosition({ x: 0.5, y: 0.4 }, size)).toBe('50% 0%')
  expect(coverObjectPosition({ x: 0.5, y: 0.6 }, size)).toBe('50% 100%')
  expect(coverObjectPosition({ x: 0.5, y: 0.1 }, size)).toBe('50% 0%')
  expect(coverObjectPosition({ x: 0.9, y: 0.5 }, size)).toBe('50% 50%')
  expect(coverSquare({ x: null, y: 0.9 }, size)).toEqual({ sx: 1, sy: 0.8, x: 0.5, y: 0.6 })
  // Without the photo's size the centre is used as is.
  expect(coverObjectPosition({ x: 0.3, y: null }, {})).toBe('30% 50%')
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

test('edition on the visitor page: short in the info column, long in Details', () => {
  const e = {
    objectEdition: 'edition',
    objectEditionNo: 3,
    objectEditionOf: 8,
    objectArtistProofs: 2,
  }
  expect(objectEditionLine(e, 'short')).toBe('Edition 3 of 8 + 2 AP')
  expect(objectEditionLine(e, 'long')).toBe('3 of 8 + 2 artist’s proofs')
  expect(objectEditionLine({ ...e, objectArtistProofs: 1 }, 'long')).toBe(
    '3 of 8 + 1 artist’s proof',
  )
  expect(objectEditionLine({ objectEdition: 'edition', objectEditionOf: 8 }, 'short')).toBe(
    'Edition of 8',
  )
  expect(objectEditionLine({ objectEdition: 'edition', objectEditionOf: 8 }, 'long')).toBe(
    'An edition of 8',
  )
  expect(objectEditionLine({ objectEdition: 'unique' }, 'long')).toBe('Unique piece')
  expect(objectEditionLine({}, 'short')).toBeNull()
})

test('grid card: only an Object gets its cover crop', () => {
  expect(objectCardOf({ artworkType: 'image' })).toBeNull()
  expect(
    objectCardOf({
      artworkType: 'object',
      coverCropX: 0.5,
      coverCropY: 0.4,
      originalWidth: 4000,
      originalHeight: 5000,
    }),
  ).toEqual({ coverPosition: '50% 0%' })
})
