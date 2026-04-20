'use client'

import type { SkuData } from './getPrintCatalog'

/**
 * Two caches, different lifetimes:
 *
 *  - `cachedCatalog` — full SKU/variant data. In-memory only; always
 *    re-fetched on a fresh session so pricing/availability stay honest.
 *  - `cachedCountries` — the list of ISO country codes the wizard can
 *    ship to. Persisted in localStorage (7-day TTL) because the set of
 *    supported countries barely changes, and it's the one thing that
 *    blocks the buyer from *starting* the flow. Once a user has loaded
 *    the wizard successfully on this device, the destinations dropdown
 *    renders instantly from here — even on a direct cold-cache deep-link.
 */
const COUNTRIES_STORAGE_KEY = 'prodigi-countries-v1'
const COUNTRIES_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

type StoredCountries = { at: number; countries: string[] }

let cachedCatalog: SkuData[] | null = null
let cachedCountries: string[] | null = null

function readCountriesFromStorage(): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(COUNTRIES_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredCountries
    if (!parsed || !Array.isArray(parsed.countries)) return null
    if (Date.now() - parsed.at > COUNTRIES_TTL_MS) {
      window.localStorage.removeItem(COUNTRIES_STORAGE_KEY)
      return null
    }
    return parsed.countries
  } catch {
    return null
  }
}

function writeCountriesToStorage(countries: string[]) {
  if (typeof window === 'undefined') return
  try {
    const entry: StoredCountries = { at: Date.now(), countries }
    window.localStorage.setItem(COUNTRIES_STORAGE_KEY, JSON.stringify(entry))
  } catch {
    // Quota / private mode / disabled — silently skip.
  }
}

// ── Full catalog (in-memory only) ────────────────────────────

export function getCachedCatalog(): SkuData[] | null {
  return cachedCatalog
}

export function setCachedCatalog(catalog: SkuData[]) {
  cachedCatalog = catalog
}

// ── Countries list (in-memory + localStorage) ────────────────

export function getCachedCountries(): string[] | null {
  return cachedCountries
}

export function setCachedCountries(countries: string[]) {
  cachedCountries = countries
  writeCountriesToStorage(countries)
}

/**
 * Pull the persisted countries list (if any) into the module-level
 * cache. Must be called from a client-only hook (useEffect) — never
 * during render — to avoid hydration mismatches.
 */
export function hydrateCountriesFromStorage() {
  if (cachedCountries) return
  const fromStorage = readCountriesFromStorage()
  if (fromStorage) cachedCountries = fromStorage
}
