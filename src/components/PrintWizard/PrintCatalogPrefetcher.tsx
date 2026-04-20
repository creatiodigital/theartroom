'use client'

import { useEffect } from 'react'

import { getCachedCatalog, setCachedCatalog, setCachedCountries } from './catalogClientCache'
import { getPrintCatalog } from './getPrintCatalog'
import { collectAllCountries } from './options'

/**
 * Invisible prefetcher for the Prodigi catalog. Mount on pages that
 * funnel users toward the print wizard (home, /prints, artwork detail)
 * so the ~70-SKU round-trip happens in the background — by the time the
 * buyer opens the wizard, both the server cache and the client cache
 * are warm and the countries dropdown renders instantly.
 *
 * We deliberately do NOT abort the fetch on unmount. The point is to
 * warm the cache for future pages — if the user navigates home → prints
 * mid-flight, the result should still land in cache so the /prints
 * prefetcher (or the wizard itself) picks it up. Module-level `inflight`
 * dedupes concurrent mounts so we never fire the 70-SKU batch twice.
 */
let inflight: Promise<void> | null = null

export const PrintCatalogPrefetcher = () => {
  useEffect(() => {
    if (getCachedCatalog()) return
    if (inflight) return
    inflight = getPrintCatalog()
      .then((res) => {
        if (res.ok) {
          setCachedCatalog(res.skus)
          setCachedCountries(collectAllCountries(res.skus))
        }
      })
      .finally(() => {
        inflight = null
      })
  }, [])
  return null
}
