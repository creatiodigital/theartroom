'use client'

import { useSyncExternalStore } from 'react'

import { isTouchDevice } from '@/hooks/useIsTouchDevice'

/**
 * Phones only, not tablets: a touch device whose screen is under 600px on its short side (Android's
 * own phone/tablet line). Every iPhone is far below it either way up (320–440); every iPad is above
 * it (the mini is 744). The screen, not the window, so turning the phone doesn't change the answer.
 */
const PHONE_SHORT_SIDE = 600

export const isPhone = () =>
  isTouchDevice() && Math.min(window.screen.width, window.screen.height) < PHONE_SHORT_SIDE

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia('(pointer: coarse)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** False while rendering on the server; the device's real answer from hydration on. */
export const useIsPhone = (): boolean => useSyncExternalStore(subscribe, isPhone, () => false)
