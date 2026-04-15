import type {
  ProdigiOrderRequest,
  ProdigiOrderResponse,
  ProdigiProductResponse,
  ProdigiQuoteRequest,
  ProdigiQuoteResponse,
} from './types'

let apiKey = process.env.PRODIGI_API_KEY
let apiUrl = process.env.PRODIGI_API_URL ?? 'https://api.sandbox.prodigi.com/v4.0'

/**
 * Override the base URL and/or API key at runtime. Used by the discovery
 * script to read the full production catalog without touching .env.local.
 */
export function configureProdigi(opts: { baseUrl?: string; apiKey?: string }) {
  if (opts.baseUrl) apiUrl = opts.baseUrl
  if (opts.apiKey) apiKey = opts.apiKey
}

export class ProdigiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message)
    this.name = 'ProdigiError'
  }
}

async function request<T>(path: string, init: RequestInit & { body?: string } = {}): Promise<T> {
  if (!apiKey) {
    throw new Error('PRODIGI_API_KEY is not set')
  }
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new ProdigiError(
      `Prodigi ${init.method ?? 'GET'} ${path} failed: ${res.status}`,
      res.status,
      body,
    )
  }
  return body as T
}

export function getProduct(sku: string) {
  return request<ProdigiProductResponse>(`/products/${encodeURIComponent(sku)}`)
}

export function createQuote(body: ProdigiQuoteRequest) {
  return request<ProdigiQuoteResponse>(`/quotes`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function createOrder(body: ProdigiOrderRequest) {
  // Safety guard: refuse to create real orders against production unless
  // explicitly allowed. Lets us develop with the production catalog (for
  // reads/quotes) without risking accidental fulfillment.
  const isProduction = apiUrl.includes('api.prodigi.com') && !apiUrl.includes('sandbox')
  const prodOrdersAllowed = process.env.PRODIGI_ALLOW_PROD_ORDERS === 'true'
  if (isProduction && !prodOrdersAllowed) {
    throw new Error(
      'createOrder blocked: base URL is production but PRODIGI_ALLOW_PROD_ORDERS is not set. ' +
        'Either switch to the sandbox URL or set PRODIGI_ALLOW_PROD_ORDERS=true to place real orders.',
    )
  }
  return request<ProdigiOrderResponse>(`/orders`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getOrder(id: string) {
  return request<ProdigiOrderResponse>(`/orders/${encodeURIComponent(id)}`)
}

export function cancelOrder(id: string) {
  return request<ProdigiOrderResponse>(`/orders/${encodeURIComponent(id)}/actions/cancel`, {
    method: 'POST',
  })
}
