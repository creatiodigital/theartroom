'use server'

import { unstable_cache } from 'next/cache'

import { ProdigiError, getProduct } from '@/lib/prodigi/client'
import { enumerateProdigiSkus } from './resolveSku'

export type ProdigiSkuVariant = {
  attributes: Record<string, string>
  shipsTo: string[]
}

export type ProdigiSkuData = {
  sku: string
  variants: ProdigiSkuVariant[]
}

export type ProdigiCatalogResult =
  | { ok: true; skus: ProdigiSkuData[] }
  | { ok: false; error: string }

const PRODIGI_CATALOG_TAG = 'prodigi-catalog'
const CONCURRENCY = 8
const PER_REQUEST_TIMEOUT_MS = 8000

let inflight: Promise<ProdigiCatalogResult> | null = null

async function fetchWithTimeout(sku: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS)
  try {
    return await getProduct(sku)
  } finally {
    clearTimeout(timer)
  }
}

const loadCatalogCached = unstable_cache(
  async () => {
    const result = await loadCatalog()
    if (!result.ok) throw new Error(result.error)
    return result
  },
  ['prodigi-catalog-v1'],
  { tags: [PRODIGI_CATALOG_TAG], revalidate: 86400 },
)

export async function getProdigiCatalog(): Promise<ProdigiCatalogResult> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      return await loadCatalogCached()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load print catalog.'
      return { ok: false, error: message }
    }
  })()
  try {
    return await inflight
  } finally {
    inflight = null
  }
}

async function loadCatalog(): Promise<ProdigiCatalogResult> {
  const skus = enumerateProdigiSkus()

  console.info(`[Prodigi/loadCatalog] fetching ${skus.length} SKUs (concurrency=${CONCURRENCY})`)

  const ok: ProdigiSkuData[] = []
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
      console.warn(`[Prodigi/loadCatalog] ${sku} failed:`, r.reason)
    })
  }

  console.info(
    `[Prodigi/loadCatalog] done — ok=${ok.length}, skipped=${skipped.length}, errors=${errors}`,
  )
  if (skipped.length > 0) {
    console.info(
      `[Prodigi/loadCatalog] skipped SKUs:`,
      skipped.map((s) => `${s.sku}(${s.status})`).join(', '),
    )
  }

  if (ok.length === 0) {
    return { ok: false, error: 'Could not load print catalog.' }
  }
  return { ok: true, skus: ok }
}
