import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { auth } from '@/auth'
import { AdminAnalytics } from '@/components/admin/analytics/AdminAnalytics'
import {
  ANALYTICS_RANGES,
  ANALYTICS_SPLITS,
  type AnalyticsRange,
  type AnalyticsSplit,
} from '@/lib/analytics/reportShape'
import { isAdminOrAbove } from '@/lib/authUtils'

import { getAnalyticsPageData } from './report'

export const metadata: Metadata = {
  title: { absolute: 'Analytics — The Art Room Admin' },
  robots: { index: false, follow: false },
}

// The report is cached per period and split (report.ts); the page itself is per request.
export const dynamic = 'force-dynamic'

type AdminAnalyticsPageProps = {
  searchParams: Promise<{ range?: string; split?: string }>
}

/**
 * Admin · Analytics: GA4 for one period (7 / 30 / 90 days, default 30) split one way (device,
 * country, source, new or returning; default device). Read on the server: the proxy lets only
 * admins into /admin, and this page checks again before reading anything.
 */
export default async function AdminAnalyticsPage({ searchParams }: AdminAnalyticsPageProps) {
  const session = await auth()
  if (!isAdminOrAbove(session?.user?.userType)) notFound()

  const params = await searchParams
  const asRange = Number(params.range)
  const range: AnalyticsRange = (ANALYTICS_RANGES as readonly number[]).includes(asRange)
    ? (asRange as AnalyticsRange)
    : 30
  const split: AnalyticsSplit = (ANALYTICS_SPLITS as readonly string[]).includes(params.split ?? '')
    ? (params.split as AnalyticsSplit)
    : 'device'

  const result = await getAnalyticsPageData(range, split)
  return <AdminAnalytics result={result} range={range} split={split} />
}
