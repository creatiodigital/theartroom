// What the admin Analytics page reads (src/lib/analytics/ga4Report.ts builds it on the server).
// Plain values and types only, so client components can import it.

export const ANALYTICS_RANGES = [7, 30, 90] as const
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]

export const ANALYTICS_SPLITS = ['device', 'country', 'source', 'visitor'] as const
export type AnalyticsSplit = (typeof ANALYTICS_SPLITS)[number]

export const OTHER_SEGMENT = 'Other'

export type FunnelStepId = 'visit' | 'artwork' | 'configurator' | 'cart' | 'checkout' | 'order'

export type FunnelStep = {
  id: FunnelStepId
  label: string
  /** People (GA4 total users) who reached the step in the period. */
  total: number
  /** The same, the period before. */
  previous: number
  /** People per segment (segment labels as in `segments`). */
  bySegment: Record<string, number>
}

export type AnalyticsReport = {
  range: AnalyticsRange
  split: AnalyticsSplit
  /** Named segments in colour order, then "Other" when anything folded into it. */
  segments: string[]
  totals: {
    visitors: { current: number; previous: number }
    sessions: { current: number; previous: number }
    /** Engaged sessions ÷ sessions, 0–1. */
    engagement: { current: number; previous: number }
  }
  /** Sessions per day (YYYY-MM-DD, Madrid), per segment; every day of the period, zeros included. */
  daily: { date: string; values: Record<string, number> }[]
  funnel: FunnelStep[]
  checkoutErrors: { step: string; reason: string; count: number }[]
  room: {
    /** People who opened a 3D room page (has history). */
    visitors: number
    visitorsBySegment: Record<string, number>
    /** From the room events (AR-185 on). */
    loaded: number
    leftWhileLoading: number
    avgLoadMs: number | null
    avgSecondsInRoom: number | null
    avgWorksViewed: number | null
    detailsOpened: number
    errors: { reason: string; count: number }[]
  }
  /** By artwork slug: people on its page, and people who opened its print configurator. */
  artworks: { slug: string; viewers: number; configurator: number }[]
  sources: { source: string; sessions: number; engaged: number }[]
  landingPages: { path: string; sessions: number; engaged: number }[]
}
