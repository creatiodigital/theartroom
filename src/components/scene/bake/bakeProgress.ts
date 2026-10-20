import { useSyncExternalStore } from 'react'

/**
 * A bake's progress on the visit page, for the loader that hides the room until its light is on: the
 * admin's bake (bake mode) or a stored bake being applied. A tiny external store: the visit page and
 * `BakedLighting` write, the visit page's loader reads.
 */
export type BakeProgress = {
  /**
   * `failed`: a stored bake could not be put on the room — the room goes back to today's look
   * (`markStoredBakeFailed`). Like `finished`, it ends the wait: the loader never stays up over a
   * failure.
   */
  phase: 'idle' | 'running' | 'finished' | 'failed'
  /** 0..1, never decreasing within a run. */
  fraction: number
}

const IDLE: BakeProgress = { phase: 'idle', fraction: 0 }

let state: BakeProgress = IDLE
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((listener) => listener())

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const setBakeProgress = (phase: BakeProgress['phase'], fraction = 0) => {
  const next = Math.min(1, Math.max(0, fraction))
  const fractionNow = phase === 'running' ? Math.max(state.fraction, next) : next
  if (state.phase === phase && state.fraction === fractionNow) return
  state = { phase, fraction: fractionNow }
  emit()
}

export const resetBakeProgress = () => {
  if (state === IDLE) return
  state = IDLE
  emit()
}

export const getBakeProgress = (): BakeProgress => state

/** The wait is over: the bake is on, or it failed and the room keeps today's look. */
export const bakeSettled = (progress: BakeProgress) =>
  progress.phase === 'finished' || progress.phase === 'failed'

export const useBakeProgress = (): BakeProgress =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => IDLE,
  )
