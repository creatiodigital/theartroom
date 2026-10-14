'use client'

import { useSyncExternalStore } from 'react'

/**
 * The 3D walk-through walks on the keyboard and looks around on hold-and-drag,
 * so it is offered only to laptops and desktops driven by a mouse or trackpad:
 * laptop width AND a fine pointer that can hover. A finger is neither, so a
 * touch-first tablet fails this at any size.
 *
 * Mirror of the `walkthrough-device` mixin in src/styles/mixins.scss, which
 * gates the Enter button in CSS so it never flashes on a phone. Keep the two
 * in sync.
 */
export const WALKTHROUGH_MEDIA_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'

/**
 * Size is no test for an iPad: a 13" one held sideways is wider than many
 * laptops, and with a trackpad attached it can report the same pointer a laptop
 * does. Safari on iPadOS also calls itself a Mac — but no Mac has a multi-touch
 * screen, so that pairing gives it away.
 */
const isIPad = () =>
  /iPad/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

const canEnterWalkthrough = () => window.matchMedia(WALKTHROUGH_MEDIA_QUERY).matches && !isIPad()

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(WALKTHROUGH_MEDIA_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/**
 * Whether this device may enter the 3D walk-through. The server cannot know,
 * so it renders as if it can; React swaps in the device's real answer straight
 * after hydration, and uses it from the first render on client navigation.
 */
export const useCanEnterWalkthrough = (): boolean =>
  useSyncExternalStore(subscribe, canEnterWalkthrough, () => true)
