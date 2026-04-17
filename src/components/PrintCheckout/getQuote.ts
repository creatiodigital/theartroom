'use server'

import { createQuote, getProduct } from '@/lib/prodigi/client'
import { resolveSku } from '@/components/PrintWizard/options'
import type { PrintConfig } from '@/components/PrintWizard/types'

export type ProdigiQuoteResult = {
  itemCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
  currency: string
}

export type ProdigiQuoteResponse =
  | { ok: true; data: ProdigiQuoteResult }
  | { ok: false; error: string; sku: string }

/**
 * Ask Prodigi for a real quote for the given config shipped to `countryCode`.
 * Returns null if the product doesn't resolve or the quote call fails.
 * Prices come back in EUR cents (or whatever Prodigi returns for that SKU).
 */
export async function getProdigiQuote(
  config: PrintConfig,
  countryCode: string,
): Promise<ProdigiQuoteResponse> {
  const { sku, attributes } = resolveSku(config)

  try {
    const product = await getProduct(sku)
    const allAttrs: Record<string, string> = {}
    for (const [name, values] of Object.entries(product.product.attributes)) {
      allAttrs[name] = attributes[name] ?? values[0]
    }

    const quote = await createQuote({
      shippingMethod: 'Standard',
      destinationCountryCode: countryCode,
      items: [
        {
          sku,
          copies: 1,
          attributes: allAttrs,
          assets: Object.keys(product.product.printAreas).map((pa) => ({
            printArea: pa,
          })),
        },
      ],
    })

    const q = quote.quotes?.[0]
    if (!q) {
      return {
        ok: false,
        error: 'Prodigi returned no quotes for this configuration.',
        sku,
      }
    }

    return {
      ok: true,
      data: {
        itemCents: Math.round(Number(q.costSummary.items.amount) * 100),
        shippingCents: Math.round(Number(q.costSummary.shipping.amount) * 100),
        taxCents: Math.round(Number(q.costSummary.totalTax.amount) * 100),
        totalCents: Math.round(Number(q.costSummary.totalCost.amount) * 100),
        currency: q.costSummary.totalCost.currency,
      },
    }
  } catch (err) {
    console.warn(`[getProdigiQuote] ${sku} → ${countryCode} failed:`, err)
    const body =
      err && typeof err === 'object' && 'body' in err
        ? JSON.stringify((err as { body: unknown }).body)
        : err instanceof Error
          ? err.message
          : String(err)
    return { ok: false, error: body, sku }
  }
}
