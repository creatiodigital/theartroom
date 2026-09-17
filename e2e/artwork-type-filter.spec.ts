import { test, expect } from '@playwright/test'
import { parseArtworkTypeFilter } from '../src/lib/artworkTypeFilter'

test('each of the five filters survives a round trip', () => {
  for (const value of ['all', 'image', 'text', 'sound', 'video'] as const) {
    expect(parseArtworkTypeFilter(value)).toBe(value)
  }
})

test('nothing stored yet means All', () => {
  expect(parseArtworkTypeFilter(null)).toBe('all')
})

test('a value the app no longer understands falls back to All', () => {
  // A filter removed in a later release, or an entry edited by hand. Trusting it
  // would leave the library filtered to a type nothing can match, which reads as
  // "my artworks are gone" rather than as a stale filter.
  expect(parseArtworkTypeFilter('sculpture')).toBe('all')
  expect(parseArtworkTypeFilter('')).toBe('all')
})

test('matching is exact, not merely prefixed or cased', () => {
  expect(parseArtworkTypeFilter('Image')).toBe('all')
  expect(parseArtworkTypeFilter('image ')).toBe('all')
  expect(parseArtworkTypeFilter('images')).toBe('all')
})
