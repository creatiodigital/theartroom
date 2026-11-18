// The Analytics page's data, server-only: the GA4 report for one period and split (cached, see
// below) plus the artworks' titles and artists from the database. The page checks the admin
// before calling this; nothing here is exposed as an action.
import { unstable_cache } from 'next/cache'

import { isGa4Configured } from '@/lib/analytics/ga4'
import {
  fetchAnalyticsReport,
  type AnalyticsRange,
  type AnalyticsReport,
  type AnalyticsSplit,
} from '@/lib/analytics/ga4Report'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'

const CACHE_SECONDS = 30 * 60
const ARTWORKS_SHOWN = 10

export type AnalyticsPageData = Omit<AnalyticsReport, 'artworks'> & {
  artworks: (AnalyticsReport['artworks'][number] & { title: string; artistName: string })[]
  /** ISO time of the GA4 read, for "Updated …". */
  fetchedAt: string
}

export type AnalyticsPageResult =
  | { ok: true; data: AnalyticsPageData }
  | { ok: false; notConfigured?: boolean; error: string }

async function readReport(
  range: AnalyticsRange,
  split: AnalyticsSplit,
): Promise<AnalyticsPageData> {
  const report = await fetchAnalyticsReport(range, split)

  // Name the artworks GA saw; slugs the database no longer has (renamed, deleted) are dropped.
  const slugs = report.artworks.map((a) => a.slug)
  const rows = await prisma.artwork.findMany({
    where: { slug: { in: slugs } },
    select: {
      slug: true,
      title: true,
      name: true,
      user: { select: { name: true, lastName: true } },
    },
  })
  const bySlug = new Map(rows.map((r) => [r.slug, r]))
  const artworks: AnalyticsPageData['artworks'] = []
  for (const a of report.artworks) {
    const row = bySlug.get(a.slug)
    if (!row) continue
    artworks.push({
      ...a,
      title: row.title || row.name,
      artistName: [row.user.name, row.user.lastName].filter(Boolean).join(' ').trim(),
    })
    if (artworks.length >= ARTWORKS_SHOWN) break
  }

  return { ...report, artworks, fetchedAt: new Date().toISOString() }
}

// Next's data cache, per period and split: shared across serverless instances; GA4 itself lags,
// so half an hour loses nothing. Errors are not cached (the next visit tries again).
const cachedReport = unstable_cache(readReport, ['admin-analytics-report-v1'], {
  revalidate: CACHE_SECONDS,
})

export async function getAnalyticsPageData(
  range: AnalyticsRange,
  split: AnalyticsSplit,
): Promise<AnalyticsPageResult> {
  if (!isGa4Configured()) {
    return { ok: false, notConfigured: true, error: 'GA4 is not configured for this environment.' }
  }
  try {
    return { ok: true, data: await cachedReport(range, split) }
  } catch (err) {
    captureError(err, { flow: 'admin', stage: 'analytics-page', level: 'warning' })
    return { ok: false, error: 'Could not load analytics from GA4.' }
  }
}
