import type { ProviderId, SpecsSummary, WizardConfig } from '@/lib/print-providers'

import type { ShippingAddress } from '@/components/checkout/PrintCheckout/createPaymentIntent'

/**
 * Provider-agnostic stash written by the checkout step and consumed by
 * the payment step. Includes the resolved provider, the buyer's full
 * WizardConfig (so we can reconstruct or re-quote), pre-computed spec
 * labels for the order summary, and the server-validated totals.
 */
export type StashedPayment = {
  clientSecret: string
  paymentIntentId: string
  totals: {
    productionCents: number
    shippingCents: number
    artistCents: number
    galleryCents: number
    customerVatCents: number
    totalCents: number
    currency: string
  }
  address: ShippingAddress
  providerId: ProviderId
  config: WizardConfig
  specs: SpecsSummary
  country: string
}
