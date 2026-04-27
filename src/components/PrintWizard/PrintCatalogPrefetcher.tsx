'use client'

import { useEffect } from 'react'

import { getProdigiCatalog } from '@/lib/print-providers/prodigi/loadCatalog'

/**
 * Invisible prefetcher for the Prodigi SKU catalog. Mount on pages that
 * funnel users toward the print wizard (home, /prints, artwork detail)
 * so the ~70-SKU round-trip happens in the background — by the time the
 * buyer opens the wizard, the server-side `unstable_cache` is warm and
 * the page renders without paying the cold-cache cost.
 *
 * Module-level `inflight` dedupes concurrent mounts so we never fire
 * the batch twice within the same session.
 *
 * Provider-specific by design: the home/prints/detail pages don't yet
 * know which artwork (and which provider) the visitor will click into.
 * We pre-warm Prodigi here as the most common provider; TPS catalogs
 * are static (hardcoded data) so they don't need a prefetch.
 */
let inflight: Promise<unknown> | null = null

export const PrintCatalogPrefetcher = () => {
  useEffect(() => {
    if (inflight) return
    inflight = getProdigiCatalog().finally(() => {
      inflight = null
    })
  }, [])
  return null
}
