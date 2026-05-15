/**
 * The Print Lab adapter — implements the canonical PrintProvider
 * contract. Built up incrementally as the user supplies catalog data
 * (papers, frames, sizes, substrates, hangings) and the price tables.
 *
 * The wizard never imports from this folder directly. Page route
 * dispatches via `getProvider('tpl')` (see ../registry / the
 * loadProviderCatalog dispatcher).
 */
import type { LoadCatalogInput, PrintProvider } from '../types'
import { buildTplAvailability, buildTplCatalog } from './buildCatalog'
import { estimateTplDelivery } from './delivery'
import { getTplQuote } from './getQuote'

export const tplProvider: PrintProvider = {
  id: 'tpl',

  async loadCatalog(input: LoadCatalogInput) {
    return buildTplCatalog(input)
  },

  buildAvailability() {
    return buildTplAvailability()
  },

  getQuote: getTplQuote,

  estimateDelivery: estimateTplDelivery,
}

export { buildTplAvailability, buildTplCatalog } from './buildCatalog'
export { getTplQuote } from './getQuote'
export { loadTplCatalog } from './loadCatalog'
export * from './data'
export * from './sizeBounds'
