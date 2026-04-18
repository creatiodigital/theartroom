'use client'

import type { SkuData } from './getPrintCatalog'

/**
 * Client-side cache for the Prodigi catalog result. Survives Next.js
 * client-side navigations (wizard → checkout → wizard) as long as the
 * JS module stays loaded — so returning to the wizard is instant, no
 * loading flash.
 *
 * This is purely a UX polish on top of the server-side TTL cache: the
 * server still revalidates when the user hard-reloads, but soft
 * navigations never need to wait for it.
 */
let cachedCatalog: SkuData[] | null = null

export function getCachedCatalog(): SkuData[] | null {
  return cachedCatalog
}

export function setCachedCatalog(catalog: SkuData[]) {
  cachedCatalog = catalog
}
