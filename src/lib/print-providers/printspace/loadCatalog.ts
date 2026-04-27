'use server'

import type { Catalog, LoadCatalogInput } from '../types'
import { buildPrintspaceCatalog } from './buildCatalog'

/**
 * The Print Space catalog is fully static (no API). This wrapper just
 * exists for parity with the Prodigi adapter so the dispatcher can
 * call `loadCatalog` uniformly.
 */
export async function loadPrintspaceCatalog(input: LoadCatalogInput): Promise<Catalog> {
  return buildPrintspaceCatalog(input)
}
