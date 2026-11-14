import { test, expect } from '@playwright/test'

import {
  ENGLISH,
  roomLanguageOnEntry,
  roomTextOf,
  secondLanguageOf,
  secondTextFields,
} from '../src/lib/roomLanguage'

// AR-182 (docs/wall-languages): which words a text artwork shows in the room, and which language
// the room opens in. Pure functions, exercised directly.

const text = {
  textContent: 'The garden in winter',
  textContentSecond: 'Le jardin en hiver',
}

test.describe('roomTextOf', () => {
  test('English room: the English text', () => {
    expect(roomTextOf(text, null)).toBe('The garden in winter')
  })

  test('second-language room: the second version, whatever the language', () => {
    expect(roomTextOf(text, 'fr')).toBe('Le jardin en hiver')
    // The version doesn't record a language: it shows in the exhibition's second language.
    expect(roomTextOf(text, 'es')).toBe('Le jardin en hiver')
  })

  test('no second version: English (a name or a date is the same in both)', () => {
    expect(roomTextOf({ textContent: 'Anna Berg', textContentSecond: null }, 'fr')).toBe(
      'Anna Berg',
    )
    expect(roomTextOf({ ...text, textContentSecond: '   ' }, 'fr')).toBe('The garden in winter')
  })
})

test.describe('secondTextFields', () => {
  test('absent: left as it is; empty: none; else stored as written', () => {
    expect(secondTextFields(undefined)).toEqual({})
    expect(secondTextFields('')).toEqual({ textContentSecond: null })
    expect(secondTextFields('  ')).toEqual({ textContentSecond: null })
    expect(secondTextFields(null)).toEqual({ textContentSecond: null })
    expect(secondTextFields('Le jardin')).toEqual({ textContentSecond: 'Le jardin' })
  })
})

test.describe('roomLanguageOnEntry', () => {
  const visitor = {
    secondLanguage: 'fr',
    switchOn: true,
    requested: null,
    stored: null,
    browserLanguage: 'en-GB',
  }

  test('no second language: English, whatever is asked', () => {
    expect(
      roomLanguageOnEntry({
        ...visitor,
        secondLanguage: null,
        requested: 'fr',
        browserLanguage: 'fr',
      }),
    ).toBeNull()
    expect(roomLanguageOnEntry({ ...visitor, secondLanguage: 'xx', requested: 'xx' })).toBeNull()
  })

  test('switch on: English by default, the second language for a browser in it', () => {
    expect(roomLanguageOnEntry(visitor)).toBeNull()
    expect(roomLanguageOnEntry({ ...visitor, browserLanguage: 'fr-FR' })).toBe('fr')
    expect(roomLanguageOnEntry({ ...visitor, browserLanguage: 'FR' })).toBe('fr')
    expect(roomLanguageOnEntry({ ...visitor, browserLanguage: undefined })).toBeNull()
  })

  test("switch on: the link's ?lang, then this visit's choice, then the browser", () => {
    expect(roomLanguageOnEntry({ ...visitor, requested: 'fr' })).toBe('fr')
    expect(
      roomLanguageOnEntry({ ...visitor, requested: ENGLISH, browserLanguage: 'fr' }),
    ).toBeNull()
    expect(roomLanguageOnEntry({ ...visitor, stored: 'fr' })).toBe('fr')
    expect(roomLanguageOnEntry({ ...visitor, stored: ENGLISH, browserLanguage: 'fr' })).toBeNull()
    expect(roomLanguageOnEntry({ ...visitor, requested: ENGLISH, stored: 'fr' })).toBeNull()
    // A language the exhibition doesn't offer is ignored, never shown.
    expect(roomLanguageOnEntry({ ...visitor, requested: 'es', stored: 'fr' })).toBe('fr')
  })

  test('switch off: visitors always get English', () => {
    const off = { ...visitor, switchOn: false }
    expect(roomLanguageOnEntry({ ...off, requested: 'fr' })).toBeNull()
    expect(roomLanguageOnEntry({ ...off, stored: 'fr', browserLanguage: 'fr' })).toBeNull()
  })
})

test('secondLanguageOf: the names for the list, the switch and the welcome window', () => {
  expect(secondLanguageOf('fr')).toEqual({ code: 'fr', name: 'French', nativeName: 'Français' })
  expect(secondLanguageOf(null)).toBeNull()
  expect(secondLanguageOf('ja')).toBeNull()
})
