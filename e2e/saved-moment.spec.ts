import { test, expect } from '@playwright/test'

import { SAVED_MOMENT_MS, savedMomentTimer } from '../src/components/editorChrome/savedMoment'

/**
 * The 3D editor's Save panels say "Saved" for a moment after an accepted save, then "Save" again
 * (questions.md Q139 e, owner Q158 a: as long as the admin save bars). The timer alone, on a fake
 * clock: the panels themselves need the room (WebGL), so they are in the browser check.
 */

const fakeClock = () => {
  let now = 0
  let nextId = 1
  const due = new Map<number, { at: number; run: () => void }>()
  return {
    timers: {
      set: (run: () => void, ms: number) => {
        const id = nextId++
        due.set(id, { at: now + ms, run })
        return id
      },
      clear: (id: unknown) => {
        due.delete(id as number)
      },
    },
    advance(ms: number) {
      const end = now + ms
      for (;;) {
        const first = [...due.entries()]
          .filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0]
        if (!first) break
        due.delete(first[0])
        now = first[1].at
        first[1].run()
      }
      now = end
    },
  }
}

const setup = () => {
  const clock = fakeClock()
  let ended = 0
  const moment = savedMomentTimer(() => ended++, SAVED_MOMENT_MS, clock.timers)
  return { clock, moment, ended: () => ended }
}

test.describe('"Saved" moment (Q139 e, Q158)', () => {
  test('lasts as long as the admin save bars: 3 s', () => {
    expect(SAVED_MOMENT_MS).toBe(3000)
  })

  test('ends 3 s after an accepted save, once', () => {
    const { clock, moment, ended } = setup()
    moment.start()
    clock.advance(2999)
    expect(ended()).toBe(0)
    clock.advance(1)
    expect(ended()).toBe(1)
    clock.advance(10_000)
    expect(ended()).toBe(1)
  })

  test('a second save within 3 s gets its full 3 s', () => {
    const { clock, moment, ended } = setup()
    moment.start()
    clock.advance(1500)
    moment.start()
    clock.advance(2999)
    expect(ended()).toBe(0)
    clock.advance(1)
    expect(ended()).toBe(1)
  })

  test('an edit, or the panel closing, within 3 s stops it', () => {
    const { clock, moment, ended } = setup()
    moment.start()
    clock.advance(1000)
    moment.stop()
    clock.advance(10_000)
    expect(ended()).toBe(0)
  })
})
