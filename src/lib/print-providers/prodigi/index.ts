/**
 * Prodigi adapter — implements the canonical PrintProvider contract.
 *
 * The wizard does not import from this folder. The page route
 * instantiates the provider via `getProvider('prodigi')` (see
 * ../registry.ts), loads a catalog server-side, and passes the
 * resulting canonical Catalog into the wizard as a prop.
 *
 * Downstream Prodigi-specific consumers (admin order creation,
 * payment intent re-validation, manual fulfillment dashboard) import
 * the typed helpers from this folder directly — they're Prodigi-aware
 * by design and outside the wizard's blast radius.
 */
import type { LoadCatalogInput, PrintProvider } from '../types'
import {
  buildProdigiAvailability,
  buildProdigiCatalog,
  readProdigiProviderData,
} from './buildCatalog'
import { estimateProdigiDelivery } from './delivery'
import { getProdigiCatalog } from './loadCatalog'
import { getProdigiQuote } from './getQuote'

export const prodigiProvider: PrintProvider = {
  id: 'prodigi',

  async loadCatalog({ imageWidthPx, imageHeightPx }: LoadCatalogInput) {
    const result = await getProdigiCatalog()
    if (!result.ok) throw new Error(result.error)
    return buildProdigiCatalog({
      skus: result.skus,
      imageWidthPx,
      imageHeightPx,
    })
  },

  buildAvailability(catalog) {
    return buildProdigiAvailability(readProdigiProviderData(catalog).skus)
  },

  getQuote: getProdigiQuote,

  estimateDelivery: estimateProdigiDelivery,
}

export { buildProdigiCatalog, buildProdigiAvailability } from './buildCatalog'
export { getProdigiCatalog } from './loadCatalog'
export { getProdigiQuote } from './getQuote'
export * from './data'
export * from './config'
export * from './resolveSku'
export * from './availability'
export * from './legacy'
