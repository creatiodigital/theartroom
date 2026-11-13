'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * How long a tool panel's Save button says "Saved" after an accepted save: as long as the admin
 * save bars show it (questions.md Q139 e, owner Q158 a: the page editor, announcements and
 * exhibition settings, 3 s). Display only.
 */
export const SAVED_MOMENT_MS = 3000

type MomentTimers = {
  set: (run: () => void, ms: number) => unknown
  clear: (id: unknown) => void
}

const browserTimers: MomentTimers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
}

/**
 * The moment's one timer, without React (a Node spec drives it on its own clock): `start` (re)starts
 * it, so a second save gets its full time; `stop` cancels it (an edit, or the panel closing).
 */
export function savedMomentTimer(
  onEnd: () => void,
  ms: number = SAVED_MOMENT_MS,
  timers: MomentTimers = browserTimers,
) {
  let id: unknown = null
  const stop = () => {
    if (id === null) return
    timers.clear(id)
    id = null
  }
  const start = () => {
    stop()
    id = timers.set(() => {
      id = null
      onEnd()
    }, ms)
  }
  return { start, stop }
}

/**
 * A drop-in for a Save panel's `useState(false)` `saved`: `setSaved(true)` shows "Saved" for
 * `SAVED_MOMENT_MS`, `setSaved(false)` (the panels' edit handlers) hides it at once. The panel
 * unmounting cancels the timer. The setter keeps its identity across renders.
 */
export function useSavedMoment(
  ms: number = SAVED_MOMENT_MS,
): [saved: boolean, setSaved: (saved: boolean) => void] {
  const [saved, setSavedState] = useState(false)
  const [timer] = useState(() => savedMomentTimer(() => setSavedState(false), ms))

  useEffect(() => timer.stop, [timer])

  const setSaved = useCallback(
    (value: boolean) => {
      if (value) timer.start()
      else timer.stop()
      setSavedState(value)
    },
    [timer],
  )

  return [saved, setSaved]
}
