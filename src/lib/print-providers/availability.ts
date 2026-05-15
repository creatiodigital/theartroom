/**
 * Client-safe availability dispatcher. Given a canonical `Catalog`,
 * returns the synchronous `AvailabilityCheck` predicate the wizard
 * uses to filter dimension options as the buyer changes selections.
 *
 * The wizard imports from this file — never from any specific adapter.
 * Adapters publish their builders here; switching on `catalog.providerId`
 * picks the right one.
 */
import type { AvailabilityCheck, Catalog } from './types'
import { buildTplAvailability } from './tpl/buildCatalog'

export function buildAvailability(catalog: Catalog): AvailabilityCheck {
  switch (catalog.providerId) {
    case 'tpl':
      return buildTplAvailability()
    default:
      return () => true
  }
}
