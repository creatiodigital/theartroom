import { useSyncExternalStore } from 'react'

/**
 * AR-182: bumps each time the page finishes loading fonts. The wall typefaces load only when a
 * text first uses one (app/fonts.ts, `preload: false`), so a text measured before its font
 * arrived (textFit) was measured in a fallback face; a component calling this measures again.
 */
let version = 0
const subscribe = (onChange: () => void) => {
  if (typeof document === 'undefined' || !document.fonts) return () => {}
  const bump = () => {
    version += 1
    onChange()
  }
  document.fonts.addEventListener('loadingdone', bump)
  return () => document.fonts.removeEventListener('loadingdone', bump)
}

export const useWallFontsVersion = () =>
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  )
