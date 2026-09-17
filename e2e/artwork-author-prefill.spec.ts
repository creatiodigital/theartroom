import { test, expect } from '@playwright/test'

import { artistDisplayName, resolveArtworkAuthor } from '../src/utils/artistDisplayName'

/**
 * The Author field is free text, but in almost every case it is the artist who
 * made the work. Leaving it blank on every new artwork meant retyping the same
 * name forever — so it is prefilled, and stays overridable for the exceptions.
 *
 * The name that fills it is the ARTWORK'S artist, never the signed-in user:
 * admins edit other artists' work, and stamping the admin's name on someone
 * else's piece would be silently wrong.
 */

const ARTIST = { name: 'John', lastName: 'Doe' }

test('a display name joins first and last name', () => {
  expect(artistDisplayName(ARTIST)).toBe('John Doe')
})

test('a display name survives a missing half', () => {
  expect(artistDisplayName({ name: 'John', lastName: '' })).toBe('John')
  expect(artistDisplayName({ name: '', lastName: 'Doe' })).toBe('Doe')
})

test('a display name is empty rather than undefined when there is no artist', () => {
  // `ArtworkEditModal` populates from a payload that carries no user.
  expect(artistDisplayName(null)).toBe('')
  expect(artistDisplayName(undefined)).toBe('')
})

test('an artwork with no author is filled with its artist', () => {
  expect(resolveArtworkAuthor(null, ARTIST)).toBe('John Doe')
  expect(resolveArtworkAuthor('', ARTIST)).toBe('John Doe')
})

test('an artwork whose author is only whitespace is filled too', () => {
  expect(resolveArtworkAuthor('   ', ARTIST)).toBe('John Doe')
})

test('an author that was deliberately typed is never overwritten', () => {
  // The 5% case: a collaboration, an estate, a pseudonym.
  expect(resolveArtworkAuthor('Estate of Someone Else', ARTIST)).toBe('Estate of Someone Else')
})

test('no artist and no author leaves the field empty, not "undefined"', () => {
  expect(resolveArtworkAuthor(null, null)).toBe('')
})
