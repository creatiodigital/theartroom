'use client'

import { useSyncExternalStore } from 'react'

/**
 * ⚠️ AR-161 — the camera a bake sets for the room: its exposure and white balance. Written by
 * whatever puts a bake on the room (the live bake, a stored bake) and read by the screen effects.
 * Kept apart from the probe's stored knobs, so a bake's camera never persists into another page.
 */

let meteredWhiteBalance: [number, number, number] | null = null
const whiteBalanceListeners = new Set<() => void>()
export const setMeteredWhiteBalance = (gain: [number, number, number] | null) => {
  meteredWhiteBalance = gain
  whiteBalanceListeners.forEach((l) => l())
}
export const useMeteredWhiteBalance = () =>
  useSyncExternalStore(
    (l) => {
      whiteBalanceListeners.add(l)
      return () => whiteBalanceListeners.delete(l)
    },
    () => meteredWhiteBalance,
    () => null,
  )

let meteredExposure: number | null = null
const exposureListeners = new Set<() => void>()
export const setMeteredExposure = (value: number | null) => {
  meteredExposure = value
  exposureListeners.forEach((l) => l())
}
export const useMeteredExposure = () =>
  useSyncExternalStore(
    (l) => {
      exposureListeners.add(l)
      return () => exposureListeners.delete(l)
    },
    () => meteredExposure,
    () => null,
  )
