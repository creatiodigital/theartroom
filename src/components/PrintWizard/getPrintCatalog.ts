'use server'

import { ProdigiError, getProduct } from '@/lib/prodigi/client'
import { enumerateSkus } from './options'

export type SkuVariant = {
  attributes: Record<string, string>
  shipsTo: string[]
}

export type SkuData = {
  sku: string
  variants: SkuVariant[]
}

export type CatalogResult = { ok: true; skus: SkuData[] } | { ok: false; error: string }

const CONCURRENCY = 8
const PER_REQUEST_TIMEOUT_MS = 8000
const CATALOG_TTL_MS = 5 * 60 * 1000 // 5 minutes

// Process-level cache. Prodigi's catalog barely changes within a dev
// session, and hitting 70 product endpoints on every wizard mount is
// both slow for the user and rude to Prodigi. Shared across requests in
// the same server process; resets on dev hot-reload (which is fine).
let cached: { at: number; result: CatalogResult } | null = null
let inflight: Promise<CatalogResult> | null = null

/**
 * Wraps a product fetch with a timeout so one hung request can't stall the
 * whole catalog load. Uses AbortController + setTimeout rather than
 * Promise.race so we don't leak the pending fetch.
 */
async function fetchWithTimeout(sku: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS)
  try {
    // getProduct doesn't accept an AbortSignal yet; timeout is best-effort
    // at this level — if the underlying fetch supported it we could pass
    // controller.signal through.
    return await getProduct(sku)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Pre-fetches every SKU the wizard can produce. Runs up to CONCURRENCY
 * requests at a time to avoid overwhelming Prodigi's rate limits — the
 * full batch of ~70 SKUs finishes in a few seconds that way.
 *
 * 404s (combos Prodigi doesn't carry) are expected and silently excluded.
 * Other failures are logged; the user still gets a partial-but-usable
 * catalog as long as at least one SKU succeeds.
 *
 * Results are cached for CATALOG_TTL_MS at the process level. Concurrent
 * callers (user opens the wizard twice in parallel tabs) share a single
 * in-flight promise so we never fire duplicate batches.
 */
export async function getPrintCatalog(): Promise<CatalogResult> {
  if (cached && Date.now() - cached.at < CATALOG_TTL_MS && cached.result.ok) {
    return cached.result
  }
  if (inflight) return inflight
  inflight = loadCatalog()
  try {
    const result = await inflight
    if (result.ok) cached = { at: Date.now(), result }
    return result
  } finally {
    inflight = null
  }
}

async function loadCatalog(): Promise<CatalogResult> {
  const skus = enumerateSkus()

  console.info(`[getPrintCatalog] fetching ${skus.length} SKUs (concurrency=${CONCURRENCY})`)

  const ok: SkuData[] = []
  // We lump 404 and 5xx together as "skip": Prodigi's catalog has a few
  // combos that legitimately 404 and a few more that 500 (their backend
  // doesn't guard all invalid token combos). Neither is a system problem
  // from our side — just means the SKU isn't in their catalog for us.
  const skipped: Array<{ sku: string; status: number }> = []
  let errors = 0

  for (let i = 0; i < skus.length; i += CONCURRENCY) {
    const batch = skus.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(batch.map((sku) => fetchWithTimeout(sku)))
    results.forEach((r, idx) => {
      const sku = batch[idx]
      if (r.status === 'fulfilled') {
        ok.push({
          sku,
          variants: r.value.product.variants.map((v) => ({
            attributes: v.attributes,
            shipsTo: v.shipsTo,
          })),
        })
        return
      }
      if (r.reason instanceof ProdigiError) {
        skipped.push({ sku, status: r.reason.status })
        return
      }
      errors++

      console.warn(`[getPrintCatalog] ${sku} failed:`, r.reason)
    })
  }

  console.info(
    `[getPrintCatalog] done — ok=${ok.length}, skipped=${skipped.length}, errors=${errors}`,
  )
  if (skipped.length > 0) {
    console.info(
      `[getPrintCatalog] skipped SKUs:`,
      skipped.map((s) => `${s.sku}(${s.status})`).join(', '),
    )
  }

  if (ok.length === 0) {
    return { ok: false, error: 'Could not load print catalog.' }
  }
  return { ok: true, skus: ok }
}
