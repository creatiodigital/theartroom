import { test, expect } from '@playwright/test'

import {
  DIMMER_MIN,
  DIMMER_STANDARD,
  DIMMER_STEP,
  dimmerFraction,
  dimmerLevel,
  dimmerPercent,
} from '@/lib/bake/dimmer'
import { spaceLooks } from '@/lib/bake/spaceLooks'
import {
  LUX_PER_UNIT,
  TODAY_LOOK,
  lookSpot,
  type LookState,
} from '@/components/scene/bake/bakedLook'

// AR-161 Task 18 (spec rule 7): the artist's dimmers in a baked space are 50–100% of the
// space's calibrated lamps (slider 2–4, 4 = 100%, never above).

test('a missing level is the standard', () => {
  expect(dimmerLevel(undefined)).toBe(DIMMER_STANDARD)
  expect(dimmerLevel(null)).toBe(DIMMER_STANDARD)
  expect(dimmerLevel(Number.NaN)).toBe(DIMMER_STANDARD)
  expect(dimmerFraction(undefined)).toBe(1)
})

test('levels clamp to 2–4: never above the standard, never below half', () => {
  expect(dimmerLevel(8)).toBe(4) // vivrière's blind-tuned ceiling lamps
  expect(dimmerLevel(4.8)).toBe(4)
  expect(dimmerLevel(1.4)).toBe(2) // kritzendorf's blind-tuned track lamps
  expect(dimmerLevel(0)).toBe(2)
  expect(dimmerLevel(3.3)).toBe(3.3)
})

test('the standard is exactly 100%, slider 2 exactly half', () => {
  expect(dimmerFraction(4)).toBe(1)
  expect(dimmerFraction(2)).toBe(0.5)
  expect(dimmerFraction(3)).toBe(0.75)
})

test('every slider position reads as a whole 5% step from 50% to 100%', () => {
  const percents: number[] = []
  for (let v = DIMMER_MIN; v <= DIMMER_STANDARD + 1e-9; v += DIMMER_STEP)
    percents.push(dimmerPercent(v))
  expect(percents).toEqual([50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100])
  expect(dimmerPercent(3.3)).toBe(83) // a level stored before the rollout
})

// The approved looks: Madrid's round lamps and Paris's recessed downlights, at their space's rating.
const madrid: LookState = { baked: true, space: spaceLooks.madrid!.look }
const paris: LookState = { baked: true, space: spaceLooks.paris!.look }
const downlight = { intensity: 8, angle: 0.45, penumbra: 0.8, distance: 15 }
const round = 3000 / Math.PI / LUX_PER_UNIT
const recessed = 6800 / Math.PI / LUX_PER_UNIT

test('a baked space dims the ceiling lamps from their rating; 100% is the rating exactly', () => {
  expect(lookSpot(madrid, downlight, 'downlight', 1).intensity).toBe(round)
  expect(lookSpot(paris, downlight, 'recessed', 1).intensity).toBe(recessed)
  expect(lookSpot(paris, downlight, 'recessed', 0.5).intensity).toBe(recessed / 2)
  // The stored level no longer switches them: the dimmer alone decides.
  expect(lookSpot(madrid, { ...downlight, intensity: 0 }, 'downlight', 0.5).intensity).toBe(
    round / 2,
  )
})

test("a baked look's track lamps keep their aim and beam at the space's scale", () => {
  const track = { intensity: 8, angle: 0.8, penumbra: 0.8, distance: 4.5 }
  expect(lookSpot(paris, track, 'track')).toEqual({
    intensity: 4,
    angle: 0.8,
    penumbra: 0.4,
    distance: 0,
  })
})

test("today's look keeps every lamp as authored", () => {
  // Production before AR-161, the editor, every space without a bake.
  expect(lookSpot(TODAY_LOOK, downlight, 'downlight', 0.5)).toEqual(downlight)
  expect(lookSpot(TODAY_LOOK, downlight, 'recessed')).toEqual(downlight)
})
