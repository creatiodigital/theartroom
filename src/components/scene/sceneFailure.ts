import { useSyncExternalStore } from 'react'

/**
 * Whether the 3D scene has failed: its error boundary caught a crash, so nothing in it will finish
 * loading or baking. Set by `SceneErrorBoundary`, read by the visit page's loader, which then
 * steps aside — it must never cover the error message.
 */
let failed = false
const listeners = new Set<() => void>()

export const setSceneFailed = (value: boolean) => {
  if (failed === value) return
  failed = value
  listeners.forEach((listener) => listener())
}

export const useSceneFailed = (): boolean =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => failed,
    () => false,
  )
