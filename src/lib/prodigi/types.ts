export type ProdigiOutcome =
  | 'Ok'
  | 'Created'
  | 'CreatedWithIssues'
  | 'ValidationFailed'
  | 'NotFound'
  | 'Forbidden'

export type ProdigiMoney = { amount: string; currency: string }

export type ProdigiAsset = {
  printArea: string
  url: string
  thumbnailUrl?: string
  sizing?: 'fillPrintArea' | 'fitPrintArea' | 'stretchToPrintArea'
}

export type ProdigiRecipient = {
  name: string
  email?: string
  phoneNumber?: string
  address: {
    line1: string
    line2?: string
    postalOrZipCode: string
    countryCode: string
    townOrCity: string
    stateOrCounty?: string
  }
}

export type ProdigiProductVariant = {
  attributes: Record<string, string>
  shipsTo: string[]
  printAreaSizes: Record<string, { horizontalResolution: number; verticalResolution: number }>
  pagePricing: unknown
}

export type ProdigiProduct = {
  sku: string
  description: string
  productDimensions: {
    width: number
    height: number
    units: string
  }
  /** Map of attribute name → allowed values (e.g. { color: ['black', 'white'] }). */
  attributes: Record<string, string[]>
  printAreas: Record<string, { required: boolean }>
  variants: ProdigiProductVariant[]
}

export type ProdigiQuoteItem = {
  sku: string
  copies: number
  attributes?: Record<string, string>
  assets: Array<{ printArea: string }>
}

export type ProdigiQuoteRequest = {
  shippingMethod: 'Budget' | 'Standard' | 'Express' | 'Overnight'
  destinationCountryCode: string
  currencyCode?: string
  items: ProdigiQuoteItem[]
}

export type ProdigiQuote = {
  shipmentMethod: string
  costSummary: {
    items: ProdigiMoney
    shipping: ProdigiMoney
    totalCost: ProdigiMoney
    totalTax: ProdigiMoney
  }
  shipments: Array<{
    carrier: { name: string; service: string }
    fulfillmentLocation: { countryCode: string; labCode: string }
    cost: ProdigiMoney
    items: Array<{ itemId: string }>
  }>
  items: Array<{
    id: string
    sku: string
    copies: number
    unitCost: ProdigiMoney
    taxUnitCost: ProdigiMoney
    attributes: Record<string, string>
  }>
}

export type ProdigiOrderItem = {
  merchantReference?: string
  sku: string
  copies: number
  sizing?: 'fillPrintArea' | 'fitPrintArea' | 'stretchToPrintArea'
  attributes?: Record<string, string>
  assets: ProdigiAsset[]
  recipientCost?: ProdigiMoney
}

export type ProdigiOrderRequest = {
  merchantReference?: string
  shippingMethod: 'Budget' | 'Standard' | 'Express' | 'Overnight'
  recipient: ProdigiRecipient
  items: ProdigiOrderItem[]
  idempotencyKey?: string
  callbackUrl?: string
}

export type ProdigiOrderStatus = {
  stage: 'InProgress' | 'Complete' | 'Cancelled' | 'Draft'
  issues: Array<{ objectId: string; errorCode: string; description: string }>
  details: {
    downloadAssets: string
    printReadyAssetsPrepared: string
    allocateProductionLocation: string
    inProduction: string
    shipping: string
  }
}

export type ProdigiOrder = {
  id: string
  created: string
  lastUpdated: string
  callbackUrl?: string
  merchantReference?: string
  shippingMethod: string
  idempotencyKey?: string
  status: ProdigiOrderStatus
  charges: Array<{
    id: string
    prodigiInvoiceNumber?: string
    totalCost: ProdigiMoney
    totalTax: ProdigiMoney
  }>
  shipments: Array<{
    id: string
    carrier: { name: string; service: string }
    tracking?: { number: string; url: string }
    dispatchDate?: string
    status: string
  }>
  recipient: ProdigiRecipient
  items: Array<
    ProdigiOrderItem & {
      id: string
      status: string
    }
  >
}

export type ProdigiProductResponse = {
  outcome: ProdigiOutcome
  product: ProdigiProduct
}

export type ProdigiQuoteResponse = {
  outcome: ProdigiOutcome
  quotes: ProdigiQuote[]
  traceParent?: string
}

export type ProdigiOrderResponse = {
  outcome: ProdigiOutcome
  order: ProdigiOrder
}
