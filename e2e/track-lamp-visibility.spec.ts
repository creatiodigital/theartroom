import { test, expect } from '@playwright/test'

import { isTrackLampVisible } from '../src/components/scene/spaces/objects/TrackLamp/trackLampVisibility'

// A disabled track lamp used to stay in the scene as an unlit fixture — a lamp
// that is decoration and nothing else. Disabling now removes it outright, so
// this predicate is the single answer to "is this lamp in the scene at all",
// shared by the 3D scene and by the lighting sidebar (which greys out the
// rotation and offset sliders for a lamp that is not there).

test('a lamp with no saved settings is in the scene', () => {
  // Every lamp in an exhibition saved before this feature has no entry at all.
  expect(isTrackLampVisible(undefined)).toBe(true)
})

test('a lamp whose settings never mention enabled is in the scene', () => {
  expect(isTrackLampVisible({ rotation: 30, offset: 0.5 })).toBe(true)
})

test('an enabled lamp is in the scene', () => {
  expect(isTrackLampVisible({ rotation: 0, offset: 0, enabled: true })).toBe(true)
})

test('a disabled lamp is not in the scene', () => {
  expect(isTrackLampVisible({ rotation: 0, offset: 0, enabled: false })).toBe(false)
})
