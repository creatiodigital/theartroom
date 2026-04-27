import type { DeliveryEstimate, WizardConfig } from '../types'

/**
 * End-to-end delivery estimate for a Prodigi-routed order. Manual
 * fulfillment at launch — admin places orders by hand on Prodigi's
 * portal. Production ~3-5 working days, shipping ~5-10 working days
 * globally.
 *
 * Single global range (not per-country) since Prodigi's API doesn't
 * give us per-destination shipping windows the way TPS's published
 * rate card does. Acceptably coarse for an estimate.
 *
 * Pure function — safe to call from client components.
 */
export function estimateProdigiDelivery(_config: WizardConfig, _country: string): DeliveryEstimate {
  // 1 admin + 4 production (avg) + 5–10 shipping = 10–15 working days.
  const minWorkingDays = 1 + 3 + 5
  const maxWorkingDays = 1 + 5 + 10
  return {
    minDays: Math.ceil(minWorkingDays * 1.4),
    maxDays: Math.ceil(maxWorkingDays * 1.4),
  }
}
