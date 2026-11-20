import { test, expect } from '@playwright/test'

import { makeLook, studioLook } from '@/lib/printPresentation/look'

/**
 * The framed presentation pencils the REAL next unsold copy (owner, 2026-11-20: the random
 * "13/100" was "completely fake"), given by the render. Only the copy changes: the look's every
 * other draw stays where the owner approved it (makeLook still draws its old copy in sequence).
 *
 * Logic only.
 */
test.describe('the copy a framed render pencils', () => {
  test('is the one it is given, and nothing else in the look moves', () => {
    const old = makeLook(2024, 'limited', 100)
    const real = studioLook(2024, 'limited', 100, 1)
    expect(real.copy).toBe(1)
    expect({ ...real, copy: old.copy }).toEqual(old)
  })

  test('without a given copy, the old one stands (renders made before)', () => {
    expect(studioLook(2024, 'limited', 100, null)).toEqual(makeLook(2024, 'limited', 100))
  })
})
