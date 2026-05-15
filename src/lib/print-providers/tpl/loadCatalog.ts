'use server'

import type { Catalog, LoadCatalogInput } from '../types'
import { buildTplCatalog } from './buildCatalog'

/**
 * The Print Lab catalog is fully static (no API). This wrapper just
 * preserves the abstraction so a future second adapter would slot in
 * call `loadCatalog` uniformly.
 */
export async function loadTplCatalog(input: LoadCatalogInput): Promise<Catalog> {
  return buildTplCatalog(input)
}
