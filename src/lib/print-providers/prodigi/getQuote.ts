'use server'

import { createQuote, getProduct } from '@/lib/prodigi/client'

import type { GetQuoteInput, Quote } from '../types'
import { configToProdigi } from './config'
import {
  PRODIGI_COST_TABLE,
  PRODIGI_EU_COUNTRIES,
  PRODIGI_GALLERY_MARKUP_RATE,
  PRODIGI_MOUNT_SUPPLEMENT_CENTS,
  PRODIGI_VAT_RATE,
} from './data'
import { resolveProdigiSku } from './resolveSku'

/**
 * Provider-canonical quote for Prodigi. Calls Prodigi's live quote
 * endpoint to get item + shipping cost (deterministic by destination
 * country, no buyer address needed yet), then layers our markup +
 * conditional EU VAT on top.
 *
 * If the live quote fails we fall back to PRODIGI_COST_TABLE so the
 * wizard summary still has a number to show — the checkout flow
 * re-validates with a fresh quote later.
 */
export async function getProdigiQuote(input: GetQuoteInput): Promise<Quote> {
  const { config, country, artistPriceCents } = input
  const prodigi = configToProdigi(config)

  let itemCents = 0
  let shippingCents = 0

  try {
    const { sku, attributes } = resolveProdigiSku(prodigi)
    const product = await getProduct(sku)
    const allAttrs: Record<string, string> = {}
    for (const [name, values] of Object.entries(product.product.attributes)) {
      allAttrs[name] = attributes[name] ?? values[0]
    }

    const quote = await createQuote({
      shippingMethod: 'Standard',
      destinationCountryCode: country,
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
    if (q) {
      itemCents = Math.round(Number(q.costSummary.items.amount) * 100)
      shippingCents = Math.round(Number(q.costSummary.shipping.amount) * 100)
    } else {
      itemCents = fallbackItemCents(prodigi)
    }
  } catch (err) {
    console.warn('[Prodigi/getQuote] live quote failed, falling back to cost table:', err)
    itemCents = fallbackItemCents(prodigi)
  }

  const galleryCents = Math.round(artistPriceCents * PRODIGI_GALLERY_MARKUP_RATE)
  const subtotalCents = artistPriceCents + galleryCents + itemCents + shippingCents

  const taxCents = PRODIGI_EU_COUNTRIES.has(country)
    ? Math.round(subtotalCents * PRODIGI_VAT_RATE)
    : 0
  const totalCents = subtotalCents + taxCents

  return {
    currency: 'EUR',
    lines: [
      {
        id: 'artwork',
        label: 'Artwork',
        amountCents: artistPriceCents + galleryCents + itemCents,
      },
      { id: 'shipping', label: 'Shipping', amountCents: shippingCents, muted: true },
    ],
    subtotalCents,
    taxCents,
    taxLabel: taxCents > 0 ? 'VAT (21%)' : undefined,
    totalCents,
  }
}

function fallbackItemCents(prodigi: ReturnType<typeof configToProdigi>): number {
  const paperTable = PRODIGI_COST_TABLE[prodigi.paperId]
  if (!paperTable) return 0
  const formatTable = paperTable[prodigi.formatId]
  if (!formatTable) return 0
  const base = formatTable[prodigi.sizeId]
  if (base == null) return 0
  const isFramed = prodigi.formatId !== 'unframed'
  const mountExtra = isFramed && prodigi.mountId !== 'none' ? PRODIGI_MOUNT_SUPPLEMENT_CENTS : 0
  return base + mountExtra
}
