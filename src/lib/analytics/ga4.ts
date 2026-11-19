import { BetaAnalyticsDataClient, type protos } from '@google-analytics/data'

// Thin adapter over the GA4 Data API. Server-only: credentials come from
// GA_SERVICE_ACCOUNT_KEY (full service-account JSON, one line) and
// GA4_PROPERTY_ID (the numeric property id from GA4 Admin → Property
// settings). The GA tag only runs on production, so whichever environment
// calls this, the numbers are always production traffic.

export type Ga4ArtworkViews = { slug: string; views: number }
export type Ga4CountryRow = { country: string; sessions: number }
export type Ga4ChannelRow = { channel: string; sessions: number }

export type Ga4Snapshot = {
  topArtworks: Ga4ArtworkViews[]
  countries: Ga4CountryRow[]
  channels: Ga4ChannelRow[]
}

const RANGE = { startDate: '30daysAgo', endDate: 'today' }
// Fetch more artwork paths than we display: rows are per-path and get
// filtered to exact /artworks/<slug> matches below.
const ARTWORK_ROW_LIMIT = 50
const COUNTRY_LIMIT = 10
const CHANNEL_LIMIT = 8

type Ga4Config = { propertyId: string; clientEmail: string; privateKey: string }

function getConfig(): Ga4Config | null {
  const propertyId = process.env.GA4_PROPERTY_ID
  const rawKey = process.env.GA_SERVICE_ACCOUNT_KEY
  if (!propertyId || !rawKey) return null
  try {
    const parsed = JSON.parse(rawKey) as { client_email?: string; private_key?: string }
    if (!parsed.client_email || !parsed.private_key) return null
    return { propertyId, clientEmail: parsed.client_email, privateKey: parsed.private_key }
  } catch {
    return null
  }
}

export function isGa4Configured(): boolean {
  return getConfig() !== null
}

// Module-level client reuse across invocations of a warm serverless instance.
let client: BetaAnalyticsDataClient | null = null

function getClient(config: Ga4Config): BetaAnalyticsDataClient {
  client ??= new BetaAnalyticsDataClient({
    credentials: { client_email: config.clientEmail, private_key: config.privateKey },
  })
  return client
}

export type Ga4ReportRequest = protos.google.analytics.data.v1beta.IRunReportRequest
export type Ga4Report = protos.google.analytics.data.v1beta.IRunReportResponse

// gRPC codes GA4 answers when it is busy rather than wrong: RESOURCE_EXHAUSTED (8, e.g. more
// than 10 requests in flight for the property), UNAVAILABLE (14), DEADLINE_EXCEEDED (4).
const RETRYABLE_CODES = new Set([4, 8, 14])
const RETRY_AFTER_MS = 1500

/** The gRPC status code of a Data API error, if it has one. */
export const ga4ErrorCode = (error: unknown): number | undefined =>
  typeof error === 'object' &&
  error !== null &&
  typeof (error as { code?: unknown }).code === 'number'
    ? (error as { code: number }).code
    : undefined

/**
 * Runs report requests against the property, five per batch (the API's limit), ONE BATCH AT A
 * TIME: the property allows 10 requests in flight, and parallel batches on a cold server went over
 * it (2026-11-18, "Could not load analytics"). A busy answer is retried once. Reports come back in
 * the order asked. Throws when not configured or on any other API failure.
 */
export async function runGa4Reports(requests: Ga4ReportRequest[]): Promise<Ga4Report[]> {
  const config = getConfig()
  if (!config) throw new Error('GA4 is not configured')
  const property = `properties/${config.propertyId}`
  const reports: Ga4Report[] = []
  for (let i = 0; i < requests.length; i += 5) {
    const batch = requests.slice(i, i + 5)
    const run = () => getClient(config).batchRunReports({ property, requests: batch })
    let response
    try {
      ;[response] = await run()
    } catch (error) {
      if (!RETRYABLE_CODES.has(ga4ErrorCode(error) ?? -1)) throw error
      await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS))
      ;[response] = await run()
    }
    reports.push(...(response.reports ?? []))
  }
  return reports
}

/** Exact /artworks/<slug> pages only — wizard/checkout subroutes excluded. */
const ARTWORK_PATH = /^\/artworks\/([^/]+)$/

/**
 * One batched Data API call → the three dashboard datasets. Throws when not
 * configured or on API failure — the caller owns graceful degradation.
 */
export async function fetchGa4Snapshot(): Promise<Ga4Snapshot> {
  const config = getConfig()
  if (!config) throw new Error('GA4 is not configured')

  const [response] = await getClient(config).batchRunReports({
    property: `properties/${config.propertyId}`,
    requests: [
      {
        dateRanges: [RANGE],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: { matchType: 'BEGINS_WITH', value: '/artworks/' },
          },
        },
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: ARTWORK_ROW_LIMIT,
      },
      {
        dateRanges: [RANGE],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: COUNTRY_LIMIT,
      },
      {
        dateRanges: [RANGE],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: CHANNEL_LIMIT,
      },
    ],
  })

  const [artworkReport, countryReport, channelReport] = response.reports ?? []

  const topArtworks: Ga4ArtworkViews[] = []
  for (const row of artworkReport?.rows ?? []) {
    const path = row.dimensionValues?.[0]?.value ?? ''
    const match = ARTWORK_PATH.exec(path)
    if (!match) continue
    topArtworks.push({ slug: match[1], views: Number(row.metricValues?.[0]?.value ?? 0) })
  }

  const countries: Ga4CountryRow[] = (countryReport?.rows ?? []).map((row) => ({
    country: row.dimensionValues?.[0]?.value || 'Unknown',
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }))

  const channels: Ga4ChannelRow[] = (channelReport?.rows ?? []).map((row) => ({
    channel: row.dimensionValues?.[0]?.value || 'Unknown',
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }))

  return { topArtworks, countries, channels }
}
