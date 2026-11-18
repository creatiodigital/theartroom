/**
 * Client-side GA4 events: the one place the public site sends custom events from.
 *
 * - GA4 only loads on Vercel Production (NEXT_PUBLIC_GA_MEASUREMENT_ID), so everywhere else
 *   `track()` is a no-op apart from a console line in development.
 * - The GA scripts load `lazyOnload`, so an event can fire before `window.gtag` exists. It then
 *   waits in `window.__arEvents`, and the GA init script sends it right after its consent
 *   defaults and `config` (src/components/analytics/GoogleAnalytics.tsx), so the order stays
 *   consent → config → events.
 * - Consent is untouched: events follow the same Consent Mode state as page views.
 * - Event and parameter names follow GA4's recommended ecommerce schema where one exists
 *   (view_item, add_to_cart, begin_checkout, add_shipping_info, add_payment_info, purchase),
 *   so the built-in Monetization reports fill in without custom setup.
 */

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
const IS_DEV = process.env.NODE_ENV === 'development'

/** localStorage key that marks this browser as the gallery's own (admin, artist, curator). */
export const INTERNAL_TRAFFIC_KEY = 'ar-internal'

type Primitive = string | number | boolean
export type AnalyticsItem = Record<string, Primitive | undefined>
export type AnalyticsParams = Record<string, Primitive | AnalyticsItem[] | undefined>

type GtagWindow = Window & {
  gtag?: (...args: unknown[]) => void
  __arEvents?: [string, AnalyticsParams][]
}

// GA4 drops event parameter values longer than 100 characters.
const MAX_VALUE_LENGTH = 100

const cleanValue = (value: Primitive): Primitive =>
  typeof value === 'string' ? value.slice(0, MAX_VALUE_LENGTH) : value

const clean = (params: AnalyticsParams): AnalyticsParams => {
  const out: AnalyticsParams = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    out[key] = Array.isArray(value)
      ? value.map((item) => {
          const kept: AnalyticsItem = {}
          for (const [k, v] of Object.entries(item)) {
            if (v !== undefined && v !== '') kept[k] = cleanValue(v)
          }
          return kept
        })
      : cleanValue(value)
  }
  return out
}

/** Sends one GA4 event (or queues it until GA has loaded). Never throws. */
export const track = (name: string, params: AnalyticsParams = {}): void => {
  if (typeof window === 'undefined') return
  try {
    const payload = clean(params)
    if (IS_DEV) console.debug('[analytics]', name, payload)
    if (!GA_MEASUREMENT_ID) return
    const w = window as GtagWindow
    if (typeof w.gtag === 'function') w.gtag('event', name, payload)
    else (w.__arEvents ??= []).push([name, payload])
  } catch {
    // Analytics must never break the page.
  }
}

/**
 * Marks this browser as internal: from now on every hit carries `traffic_type: internal`, which
 * GA4's "Internal Traffic" data filter drops once it is set to Active (GA4 → Admin → Data
 * filters). The GA init script reads the flag on every page load; this also updates the page
 * that is already open.
 */
export const markInternalTraffic = (): void => {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(INTERNAL_TRAFFIC_KEY) === '1') return
    window.localStorage.setItem(INTERNAL_TRAFFIC_KEY, '1')
    const w = window as GtagWindow
    // `set` applies to every later hit on this page without re-running `config`.
    if (GA_MEASUREMENT_ID && typeof w.gtag === 'function') w.gtag('set', { traffic_type: 'internal' })
  } catch {
    // Storage blocked (private mode): nothing to remember.
  }
}
