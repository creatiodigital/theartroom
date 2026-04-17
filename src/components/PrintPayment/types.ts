import type { PrintConfig } from '@/components/PrintWizard/types'
import type { ShippingAddress } from '@/components/PrintCheckout/createPaymentIntent'

export type StashedPayment = {
  clientSecret: string
  paymentIntentId: string
  totals: {
    itemCents: number
    shippingCents: number
    artistCents: number
    galleryCents: number
    customerVatCents: number
    totalCents: number
    currency: string
  }
  address: ShippingAddress
  config: PrintConfig
  country: string
}
