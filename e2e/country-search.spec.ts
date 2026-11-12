import { test, expect } from '@playwright/test'

import { countryMatches } from '../src/lib/checkout/countrySearch'

/** "Find your country" (order-flow.md "Where we ship" window). Node only: no page, no sign-in. */
test.describe('countryMatches', () => {
  test('matches the start of any word, ignoring case', () => {
    expect(countryMatches('United Kingdom', 'king')).toBe(true)
    expect(countryMatches('United Kingdom', 'UNITED K')).toBe(true)
    expect(countryMatches('United Kingdom', 'ingdom')).toBe(false)
    expect(countryMatches('Spain', 'sp')).toBe(true)
    expect(countryMatches('Spain', 'pain')).toBe(false)
  })

  test('ignores accents on either side', () => {
    expect(countryMatches('Côte d’Ivoire', 'cote')).toBe(true)
    expect(countryMatches('Côte d’Ivoire', 'ivoire')).toBe(true)
    expect(countryMatches('Reunion', 'Réunion')).toBe(true)
  })

  test('an empty or blank query matches everything', () => {
    expect(countryMatches('Germany', '')).toBe(true)
    expect(countryMatches('Germany', '   ')).toBe(true)
  })
})
