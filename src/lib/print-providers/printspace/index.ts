/**
 * The Print Space adapter — implements the canonical PrintProvider
 * contract. Built up incrementally as the user supplies catalog data
 * (papers, frames, sizes, substrates, hangings) and the price tables.
 *
 * The catalog reaches the wizard through `loadProviderCatalog`
 * (../loadCatalog.ts); the wizard also imports this folder's static data and
 * size helpers directly.
 */
import type { LoadCatalogInput, PrintProvider } from '../types'
import { buildPrintspaceAvailability, buildPrintspaceCatalog } from './buildCatalog'
import { estimateTpsDelivery } from './delivery'
import { getPrintspaceQuote } from './getQuote'

export const printspaceProvider: PrintProvider = {
  id: 'printspace',

  async loadCatalog(input: LoadCatalogInput) {
    return buildPrintspaceCatalog(input)
  },

  buildAvailability() {
    return buildPrintspaceAvailability()
  },

  getQuote: getPrintspaceQuote,

  estimateDelivery: estimateTpsDelivery,
}

export { buildPrintspaceAvailability, buildPrintspaceCatalog } from './buildCatalog'
export { getPrintspaceQuote } from './getQuote'
export * from './data'
export * from './sizeBounds'
