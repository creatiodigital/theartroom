'use client'

import { useEffect, useState } from 'react'

import { type AnalyticsResult, getDashboardAnalytics } from '@/app/admin/analytics/actions'

// Module-level reuse: the data is by design up to 1h stale, so an admin
// bouncing between dashboard and order pages shouldn't re-POST the action
// on every mount. Successful results only — errors always retry.
let lastGoodResult: AnalyticsResult | null = null

/**
 * GA4 traffic for the dashboard — production data regardless of environment
 * (the GA tag only runs on prod). One request feeds every analytics panel.
 * null while loading. Revenue/order truth intentionally stays out — that
 * belongs to our own DB.
 */
export function useDashboardAnalytics(): AnalyticsResult | null {
  const [result, setResult] = useState<AnalyticsResult | null>(lastGoodResult)

  useEffect(() => {
    if (lastGoodResult?.ok) return
    getDashboardAnalytics()
      .then((res) => {
        if (res.ok) lastGoodResult = res
        setResult(res)
      })
      .catch(() => {
        // Transport-level failure (offline, rolling deploy) — the action's
        // own try/catch never saw it, so surface the same soft error here.
        setResult({ ok: false, error: 'Could not load analytics. Reload to retry.' })
      })
  }, [])

  return result
}
