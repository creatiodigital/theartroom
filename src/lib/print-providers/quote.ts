/**
 * Provider-agnostic quote dispatcher. The wizard imports this and passes
 * (providerId, input). Internally we route to the right adapter — wizard
 * stays oblivious to who's quoting.
 *
 * Sync + client-importable. The pricing math is pure (no DB, no fetch,
 * no secrets) so there's no reason to round-trip through a server
 * action — the buyer's price updates instantly as they drag the size
 * slider, with zero latency. Server-side payment-intent creation
 * re-runs this exact same function so the buyer can't tamper.
 */
import type { GetQuoteInput, ProviderId, Quote } from './types'
import { getTplQuote } from './tpl/getQuote'

export function getProviderQuote(providerId: ProviderId, input: GetQuoteInput): Quote {
  switch (providerId) {
    case 'tpl':
      return getTplQuote(input)
    default:
      throw new Error(`[print-providers] unknown providerId: ${providerId}`)
  }
}
