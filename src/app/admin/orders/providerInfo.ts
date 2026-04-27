/**
 * Admin-side metadata about each fulfillment provider.
 *
 * Centralised here so adding/removing a provider is a single-file edit:
 * the list page, detail page and server actions all read from this map
 * via `getProviderInfo()`. Unknown / null / removed providers fall
 * through to a safe default rather than crashing the admin UI — this
 * keeps legacy orders viewable even after a provider is dropped.
 */

export type ProviderId = 'PRODIGI' | 'PRINTSPACE'

export type ProviderInfo = {
  /** The canonical provider id used in the DB enum and code. */
  id: ProviderId
  /** Short label for badges. */
  label: string
  /** Long label for prose / headings. */
  longLabel: string
  /**
   * Whether status transitions arrive automatically (e.g. via webhook)
   * or have to be advanced by hand from the admin UI.
   */
  fulfillment: 'auto' | 'manual'
  /** Hex used for the badge dot / border. */
  color: string
}

const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  PRODIGI: {
    id: 'PRODIGI',
    label: 'Prodigi',
    longLabel: 'Prodigi',
    fulfillment: 'auto',
    color: '#3b82f6',
  },
  PRINTSPACE: {
    id: 'PRINTSPACE',
    label: 'TPS',
    longLabel: 'The Print Space',
    fulfillment: 'manual',
    color: '#8b5cf6',
  },
}

/**
 * Fallback used when an order's provider is null (legacy rows from
 * before the column existed) or when a provider id has been removed
 * from the codebase entirely. Guarantees the admin UI still renders.
 */
const UNKNOWN_PROVIDER: ProviderInfo = {
  id: 'PRODIGI', // type-coerce: callers should branch on `id` if it matters
  label: 'Unknown',
  longLabel: 'Unknown provider',
  fulfillment: 'manual', // safer default — never assume auto-updates
  color: '#9ca3af',
}

/**
 * Look up provider metadata. Always returns a value — pass through
 * `null`, removed enum values or junk and you get the unknown-provider
 * sentinel back instead of a crash.
 */
export function getProviderInfo(provider: string | null | undefined): ProviderInfo {
  if (provider && provider in PROVIDERS) {
    return PROVIDERS[provider as ProviderId]
  }
  return UNKNOWN_PROVIDER
}

/**
 * The list of providers currently active in the admin UI. Used to
 * generate provider-filter tabs / sections — driven from the registry
 * so removing a provider here automatically drops it from the UI.
 */
export function listProviders(): ProviderInfo[] {
  return Object.values(PROVIDERS)
}

export const PROVIDER_DEFAULT: ProviderId = 'PRODIGI'
