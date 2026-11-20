import { test, expect } from '@playwright/test'

import { presentationFingerprint } from '@/lib/printPresentation/inputs'

/**
 * 🔒 The framed presentation's fingerprint is frozen (owner, 2026-11-20: "make sure that when
 * deploying to prod, I won't lose the current framed renders"). Pages show a stored render while
 * its fingerprint matches the work's; if the function's output moved, every render in production
 * would read as out of date at once. These are the values it produced on 2026-11-20, before the
 * photo views were built. A change here needs the owner's go-ahead and a full re-render plan.
 *
 * Logic only: no browser, no server.
 */
const FROZEN = [
  [{ mode: 'framed', edition: null, frame: 'wood-dark', passepartout: false, ratio: 1.4925, seed: 123456789 }, '157d99d0'],
  [{ mode: 'framed', edition: null, frame: 'wood-medium', passepartout: true, ratio: 0.6667, seed: 987654321 }, '597e2a38'],
  [{ mode: 'framed', edition: null, frame: 'painted-black', passepartout: false, ratio: 1, seed: 42 }, 'f5af11d8'],
  [{ mode: 'limited', edition: 100, frame: 'wood-dark', passepartout: false, ratio: 1.4925, seed: 2024 }, '6839ca72'],
  [{ mode: 'limited', edition: 30, frame: null, passepartout: false, ratio: 1.5, seed: 77 }, 'f9d884de'],
  [{ mode: 'limited', edition: 30, frame: 'painted-off-white', passepartout: true, ratio: 0.75, seed: 31337 }, '1c032c3c'],
] as const

test.describe('the framed presentation fingerprint is frozen', () => {
  for (const [shot, fingerprint] of FROZEN) {
    test(`${shot.mode} · ${shot.frame ?? 'no frame'} · ${shot.ratio}`, () => {
      expect(presentationFingerprint(shot)).toBe(fingerprint)
    })
  }

  test('a changed value would be caught (the guard bites)', () => {
    const [shot, fingerprint] = FROZEN[0]
    expect(presentationFingerprint({ ...shot, seed: shot.seed + 1 })).not.toBe(fingerprint)
  })
})
