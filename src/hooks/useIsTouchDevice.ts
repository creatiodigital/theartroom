'use client'

import { useSyncExternalStore } from 'react'

/**
 * Phones and tablets: devices driven by a finger. Everyone can walk the 3D
 * room (AR-172); this only decides which controls a visitor is taught — the
 * finger's slides and taps, or the keyboard, mouse and trackpad.
 *
 * The main pointer says it for phones, Android tablets and an iPad on its own:
 * it is coarse. An iPad with a trackpad attached reports a laptop's fine
 * pointer, and Safari on iPadOS calls itself a Mac — but no Mac has a
 * multi-touch screen, so that pairing still gives it away. A touchscreen laptop
 * is driven by its trackpad, so it keeps the laptop guide.
 */
const COARSE_POINTER = '(pointer: coarse)'

const isIPad = () =>
  /iPad/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

const isTouchDevice = () => window.matchMedia(COARSE_POINTER).matches || isIPad()

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(COARSE_POINTER)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** False while rendering on the server; the device's real answer from hydration on. */
export const useIsTouchDevice = (): boolean =>
  useSyncExternalStore(subscribe, isTouchDevice, () => false)
