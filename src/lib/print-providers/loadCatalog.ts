'use server'

/**
 * Provider-agnostic catalog dispatcher. Page route uses this server
 * action to load the right catalog based on the artwork's chosen
 * provider. Wizard never calls this — it gets the resolved Catalog as
 * a server-rendered prop.
 */
import type { Catalog, LoadCatalogInput, ProviderId } from './types'
import { prodigiProvider } from './prodigi'
import { printspaceProvider } from './printspace'

export async function loadProviderCatalog(
  providerId: ProviderId,
  input: LoadCatalogInput,
): Promise<Catalog> {
  switch (providerId) {
    case 'prodigi':
      return prodigiProvider.loadCatalog(input)
    case 'printspace':
      return printspaceProvider.loadCatalog(input)
    default:
      throw new Error(`[print-providers] unknown providerId: ${providerId}`)
  }
}
