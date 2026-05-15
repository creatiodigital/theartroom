'use server'

/**
 * Provider-agnostic catalog dispatcher. Page route uses this server
 * action to load the catalog. Wizard never calls this — it gets the
 * resolved Catalog as a server-rendered prop.
 *
 * Single-provider today (the print lab). The dispatcher pattern is
 * preserved so adding another adapter stays a one-line switch.
 */
import type { Catalog, LoadCatalogInput, ProviderId } from './types'
import { tplProvider } from './tpl'

export async function loadProviderCatalog(
  providerId: ProviderId,
  input: LoadCatalogInput,
): Promise<Catalog> {
  switch (providerId) {
    case 'tpl':
      return tplProvider.loadCatalog(input)
    default:
      throw new Error(`[print-providers] unknown providerId: ${providerId}`)
  }
}
