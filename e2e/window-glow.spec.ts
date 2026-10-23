import { test, expect } from '@playwright/test'

import { BLOOM_INTENSITY } from '@/components/scene/spaces/objects/Effects/bloomIntensity'

// AR-165 (Eduardo 2026-10-23): "reduce the glow on the window (not the floor patches). It's a bit
// too much" — Paris (0.6 → 0.4 → "still lower it a tad" 0.3), then Madrid and Vienna ("same
// issue"). The glow is the camera's bloom on the bright glass; the room's light, its bake and the
// sun patches are untouched.

test('every space glows at the approved strength: half the old glow, still a glow', () => {
  expect(BLOOM_INTENSITY).toBe(0.3)
})
