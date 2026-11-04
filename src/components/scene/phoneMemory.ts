import { isTouchDevice } from '@/hooks/useIsTouchDevice'

/** Development and staging (the bake flags' `BAKE_DEBUG`, without importing the bake). */
const FLAGS_READ = process.env.NEXT_PUBLIC_APP_ENV !== 'production'

/**
 * AR-175 — a phone or tablet keeps the 3D room within its tab's memory. iOS gives a browser tab
 * far less memory than the device has and kills the tab outright past it (Safari reloads it,
 * Chrome shows "Can't open this page"); a larger exhibition crossed that line on an iPhone 15.
 * On a finger-driven device (`isTouchDevice`, as AR-173):
 *
 * - each artwork is held at the size it is seen, 256 to 1024 px (`Display`, `useTouchArtwork`);
 * - a stored bake's maps let go of their CPU copy once on the GPU (`lightmapLoader`);
 * - the space's own baked light leaves the GPU while a stored bake replaces it (`applyBake`).
 *
 * Laptops and desktops are unchanged.
 *
 * In development and staging only (like the bake flags), to compare on the same phone:
 * `?phonememory=0` — a touch device as before AR-175; `?phonememory=artworks,lightmaps` — only
 * the parts named (`PhoneMemoryPart`).
 */
export type PhoneMemoryPart = 'artworks' | 'lightmaps' | 'bakedlight'

export const savesPhoneMemory = (part: PhoneMemoryPart): boolean => {
  if (!isTouchDevice()) return false
  const flag = FLAGS_READ ? new URLSearchParams(window.location.search).get('phonememory') : null
  if (flag === null) return true
  return flag.split(',').includes(part)
}
