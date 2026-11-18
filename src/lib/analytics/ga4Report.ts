// The admin Analytics page's GA4 data (src/app/admin/analytics): one period, one way of splitting
// visitors, every panel read against the same slice. Server-only (credentials, see ./ga4.ts).
//
// What is left out everywhere:
// - the gallery's own traffic: hits GA4 marks with the "Internal Traffic" data filter
//   (`traffic_type: internal`, set by the site for signed-in admins, artists and curators, see
//   src/lib/analytics/track.ts). While the filter is in Testing those hits carry
//   `testDataFilterName`; once it is Active GA4 drops them itself;
// - the admin and the artists' studio (/admin, /dashboard): not visitors' pages.
//
// The funnel reads PAGES (artwork → configurator → cart → checkout), which GA4 has from the
// start, so it has history; the order step is the `purchase` event. Checkout errors and the 3D
// room's numbers come from the events added on 2026-11-18 (AR-185), so they start there.
import { runGa4Reports, type Ga4Report, type Ga4ReportRequest } from './ga4'

import {
  OTHER_SEGMENT,
  type AnalyticsRange,
  type AnalyticsReport,
  type AnalyticsSplit,
  type FunnelStep,
  type FunnelStepId,
} from './reportShape'

export * from './reportShape'

/** The segments a split shows by name; the rest fold into "Other" (charts stay readable). */
const NAMED_SEGMENTS = 3

const SPLIT_DIMENSION: Record<AnalyticsSplit, string> = {
  device: 'deviceCategory',
  country: 'country',
  source: 'sessionSource',
  visitor: 'newVsReturning',
}

/** Splits whose values are known in advance keep one colour per value, whatever the period. */
const FIXED_ORDER: Partial<Record<AnalyticsSplit, string[]>> = {
  device: ['Desktop', 'Phone', 'Tablet'],
  visitor: ['New', 'Returning'],
}

// ── Filters ──

type Filter = NonNullable<Ga4ReportRequest['dimensionFilter']>

const pathMatches = (regex: string): Filter => ({
  filter: { fieldName: 'pagePath', stringFilter: { matchType: 'FULL_REGEXP', value: regex } },
})
const eventIs = (name: string): Filter => ({
  filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: name } },
})
const eventIn = (names: string[]): Filter => ({
  filter: { fieldName: 'eventName', inListFilter: { values: names } },
})
const notInternal: Filter = {
  notExpression: {
    filter: {
      fieldName: 'testDataFilterName',
      stringFilter: { matchType: 'EXACT', value: 'Internal Traffic' },
    },
  },
}
const publicPages: Filter = {
  notExpression: {
    filter: {
      fieldName: 'pagePath',
      stringFilter: { matchType: 'PARTIAL_REGEXP', value: '^/(admin|dashboard)' },
    },
  },
}
const visitorsOnly = (...more: Filter[]): Filter => ({
  andGroup: { expressions: [notInternal, ...more] },
})

const FUNNEL: { id: FunnelStepId; label: string; filter: Filter }[] = [
  { id: 'visit', label: 'Visited the site', filter: publicPages },
  { id: 'artwork', label: 'Saw an artwork', filter: pathMatches('^/artworks/[^/]+$') },
  {
    id: 'configurator',
    label: 'Opened the print configurator',
    filter: pathMatches('^/artworks/[^/]+/print$'),
  },
  { id: 'cart', label: 'Viewed the cart', filter: pathMatches('^/cart$') },
  { id: 'checkout', label: 'Started checkout', filter: pathMatches('^/checkout$') },
  { id: 'order', label: 'Ordered', filter: eventIs('purchase') },
]

// ── Segment labels ──

/** Clicks from the owner's local dev server: not visitors. */
const LOCAL_DEV = 'Local dev'

const SOURCE_PLATFORMS: [RegExp, string][] = [
  [/^localhost|^127\.0\.0\.1/, LOCAL_DEV],
  [/^\(direct\)$/, 'Direct'],
  [/^ig$|instagram/, 'Instagram'],
  [/^fb$|facebook/, 'Facebook'],
  [/pinterest/, 'Pinterest'],
  [/linkedin|^lnkd\.in$/, 'LinkedIn'],
  [/google/, 'Google'],
  [/bing|duckduckgo|yahoo|ecosia|qwant|yandex|baidu/, 'Other search'],
  [/^t\.co$|twitter|^x\.com$/, 'X'],
  [/whatsapp/, 'WhatsApp'],
  [/mail/, 'Email'],
]

/** What a raw GA4 value is called on the page. */
export function segmentLabel(split: AnalyticsSplit, raw: string): string {
  const value = raw.trim()
  if (!value || value === '(not set)') return 'Unknown'
  switch (split) {
    case 'device':
      return value === 'mobile' ? 'Phone' : value.charAt(0).toUpperCase() + value.slice(1)
    case 'visitor':
      return value === 'new' ? 'New' : value === 'returning' ? 'Returning' : 'Unknown'
    case 'source': {
      const lower = value.toLowerCase()
      for (const [pattern, name] of SOURCE_PLATFORMS) if (pattern.test(lower)) return name
      return value
    }
    default:
      return value
  }
}

// ── Reading reports ──

type Row = { dims: string[]; metrics: number[] }

const rowsOf = (report: Ga4Report | undefined): Row[] =>
  (report?.rows ?? []).map((row) => ({
    dims: (row.dimensionValues ?? []).map((v) => v.value ?? ''),
    metrics: (row.metricValues ?? []).map((v) => Number(v.value ?? 0)),
  }))

/** The index of GA4's automatic `dateRange` dimension, when two periods were asked for. */
const dateRangeIndex = (report: Ga4Report | undefined) =>
  (report?.dimensionHeaders ?? []).findIndex((h) => h.name === 'dateRange')

const add = (into: Record<string, number>, key: string, value: number) => {
  into[key] = (into[key] ?? 0) + value
}

/** YYYY-MM-DD for "today minus n days", in the property's time zone (Madrid). */
function madridDay(daysAgo: number): string {
  const now = new Date(Date.now() - daysAgo * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(now)
}

// ── The report ──

export async function fetchAnalyticsReport(
  range: AnalyticsRange,
  split: AnalyticsSplit,
): Promise<AnalyticsReport> {
  const current = { startDate: `${range - 1}daysAgo`, endDate: 'today', name: 'current' }
  const previous = {
    startDate: `${2 * range - 1}daysAgo`,
    endDate: `${range}daysAgo`,
    name: 'previous',
  }
  const both = [current, previous]
  const splitDim = { name: SPLIT_DIMENSION[split] }
  const roomEvents = ['room_loaded', 'room_load_abandon', 'room_visit_end', 'room_artwork_details']

  const requests: Ga4ReportRequest[] = [
    // 0 · totals, both periods
    {
      dateRanges: both,
      metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'engagedSessions' }],
      dimensionFilter: visitorsOnly(publicPages),
    },
    // 1 · sessions per day per segment
    {
      dateRanges: [current],
      dimensions: [{ name: 'date' }, splitDim],
      metrics: [{ name: 'sessions' }],
      dimensionFilter: visitorsOnly(publicPages),
      limit: 10_000,
    },
    // 2–7 · the funnel, one step each, per segment, both periods
    ...FUNNEL.map(
      (step): Ga4ReportRequest => ({
        dateRanges: both,
        dimensions: [splitDim],
        metrics: [{ name: 'totalUsers' }],
        dimensionFilter: visitorsOnly(step.filter),
        limit: 1_000,
      }),
    ),
    // 8 · checkout errors by step and reason
    {
      dateRanges: [current],
      dimensions: [{ name: 'customEvent:step' }, { name: 'customEvent:reason' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: visitorsOnly(eventIs('checkout_error')),
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 12,
    },
    // 9 · the 3D room's events and their numbers
    {
      dateRanges: [current],
      dimensions: [{ name: 'eventName' }],
      metrics: [
        { name: 'eventCount' },
        { name: 'customEvent:load_ms' },
        { name: 'customEvent:seconds' },
        { name: 'customEvent:works_viewed' },
      ],
      dimensionFilter: visitorsOnly(eventIn(roomEvents)),
    },
    // 10 · the 3D room's errors
    {
      dateRanges: [current],
      dimensions: [{ name: 'customEvent:reason' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: visitorsOnly(eventIs('room_error')),
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 8,
    },
    // 11 · people who opened a 3D room, per segment
    {
      dateRanges: [current],
      dimensions: [splitDim],
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: visitorsOnly(pathMatches('^/exhibitions/[^/]+/[^/]+/visit$')),
      limit: 1_000,
    },
    // 12 · artwork pages and their configurators
    {
      dateRanges: [current],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: visitorsOnly({
        filter: {
          fieldName: 'pagePath',
          stringFilter: { matchType: 'BEGINS_WITH', value: '/artworks/' },
        },
      }),
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 500,
    },
    // 13 · where sessions came from
    {
      dateRanges: [current],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }],
      dimensionFilter: visitorsOnly(publicPages),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 200,
    },
    // 14 · the pages sessions started on
    {
      dateRanges: [current],
      dimensions: [{ name: 'landingPage' }],
      metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }],
      dimensionFilter: visitorsOnly({
        notExpression: {
          filter: {
            fieldName: 'landingPage',
            stringFilter: {
              matchType: 'PARTIAL_REGEXP',
              value: '^/(admin|dashboard)|^\\(not set\\)$',
            },
          },
        },
      }),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    },
    // 15–20 · each funnel step's total, unsplit: a person who came twice through different
    // segments counts once here (the split rows may count them in each).
    ...FUNNEL.map(
      (step): Ga4ReportRequest => ({
        dateRanges: both,
        metrics: [{ name: 'totalUsers' }],
        dimensionFilter: visitorsOnly(step.filter),
      }),
    ),
  ]

  const reports = await runGa4Reports(requests)

  // Totals
  const totalsReport = reports[0]
  const totalsIdx = dateRangeIndex(totalsReport)
  const totalsFor = (name: string) =>
    rowsOf(totalsReport).find((r) =>
      totalsIdx < 0 ? name === 'current' : r.dims[totalsIdx] === name,
    )?.metrics ?? [0, 0, 0]
  const [users, sessions, engaged] = totalsFor('current')
  const [prevUsers, prevSessions, prevEngaged] = totalsFor('previous')

  // Segments: ranked by sessions in the period (fixed order for device / visitor).
  const dailyRows = rowsOf(reports[1])
  const sessionsBySegment: Record<string, number> = {}
  for (const r of dailyRows) add(sessionsBySegment, segmentLabel(split, r.dims[1]), r.metrics[0])
  const ranked = Object.entries(sessionsBySegment)
    .filter(([label]) => label !== 'Unknown' && label !== LOCAL_DEV)
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label)
  const fixed = FIXED_ORDER[split]
  const named = (fixed ? fixed.filter((l) => ranked.includes(l)) : ranked).slice(0, NAMED_SEGMENTS)
  const segmentOf = (raw: string) => {
    const label = segmentLabel(split, raw)
    return named.includes(label) ? label : OTHER_SEGMENT
  }

  // Every day of the period, zeros included.
  const days: string[] = []
  for (let i = range - 1; i >= 0; i--) days.push(madridDay(i))
  const byDay = new Map(days.map((d) => [d, {} as Record<string, number>]))
  for (const r of dailyRows) {
    const raw = r.dims[0]
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    const day = byDay.get(date)
    if (day) add(day, segmentOf(r.dims[1]), r.metrics[0])
  }

  // Funnel
  const funnel: FunnelStep[] = FUNNEL.map((step, i) => {
    const split = reports[2 + i]
    const splitIdx = dateRangeIndex(split)
    const bySegment: Record<string, number> = {}
    for (const r of rowsOf(split)) {
      if (splitIdx >= 0 && r.dims[splitIdx] === 'previous') continue
      if (r.metrics[0] > 0) add(bySegment, segmentOf(r.dims[0]), r.metrics[0])
    }
    const totals = reports[15 + i]
    const totalsIdx = dateRangeIndex(totals)
    const totalOf = (name: string) =>
      rowsOf(totals).find((r) => (totalsIdx < 0 ? name === 'current' : r.dims[totalsIdx] === name))
        ?.metrics[0] ?? 0
    return {
      id: step.id,
      label: step.label,
      total: totalOf('current'),
      previous: totalOf('previous'),
      bySegment,
    }
  })

  const usesOther =
    Object.values(sessionsBySegment).length > named.length ||
    funnel.some((s) => (s.bySegment[OTHER_SEGMENT] ?? 0) > 0)
  const segments = usesOther ? [...named, OTHER_SEGMENT] : named

  // Checkout errors
  const checkoutErrors = rowsOf(reports[8])
    .filter((r) => r.dims[1] && r.dims[1] !== '(not set)')
    .map((r) => ({ step: r.dims[0], reason: r.dims[1], count: r.metrics[0] }))

  // 3D room
  const roomEvent = new Map(rowsOf(reports[9]).map((r) => [r.dims[0], r.metrics]))
  const loadedRow = roomEvent.get('room_loaded')
  const endRow = roomEvent.get('room_visit_end')
  const loaded = loadedRow?.[0] ?? 0
  const ends = endRow?.[0] ?? 0
  const visitorsBySegment: Record<string, number> = {}
  let roomVisitors = 0
  for (const r of rowsOf(reports[11])) {
    roomVisitors += r.metrics[0]
    add(visitorsBySegment, segmentOf(r.dims[0]), r.metrics[0])
  }

  // Artworks
  const artworkMap = new Map<string, { viewers: number; configurator: number }>()
  for (const r of rowsOf(reports[12])) {
    const page = /^\/artworks\/([^/]+)(\/print)?$/.exec(r.dims[0])
    if (!page) continue
    const entry = artworkMap.get(page[1]) ?? { viewers: 0, configurator: 0 }
    if (page[2]) entry.configurator += r.metrics[0]
    else entry.viewers += r.metrics[0]
    artworkMap.set(page[1], entry)
  }

  // Sources, by platform
  const sourceMap = new Map<string, { sessions: number; engaged: number }>()
  for (const r of rowsOf(reports[13])) {
    const name = segmentLabel('source', r.dims[0])
    if (name === LOCAL_DEV) continue
    const entry = sourceMap.get(name) ?? { sessions: 0, engaged: 0 }
    entry.sessions += r.metrics[0]
    entry.engaged += r.metrics[1]
    sourceMap.set(name, entry)
  }

  return {
    range,
    split,
    segments,
    totals: {
      visitors: { current: users, previous: prevUsers },
      sessions: { current: sessions, previous: prevSessions },
      engagement: {
        current: sessions ? engaged / sessions : 0,
        previous: prevSessions ? prevEngaged / prevSessions : 0,
      },
    },
    daily: days.map((date) => ({ date, values: byDay.get(date) ?? {} })),
    funnel,
    checkoutErrors,
    room: {
      visitors: roomVisitors,
      visitorsBySegment,
      loaded,
      leftWhileLoading: roomEvent.get('room_load_abandon')?.[0] ?? 0,
      avgLoadMs: loaded ? (loadedRow?.[1] ?? 0) / loaded : null,
      avgSecondsInRoom: ends ? (endRow?.[2] ?? 0) / ends : null,
      avgWorksViewed: ends ? (endRow?.[3] ?? 0) / ends : null,
      detailsOpened: roomEvent.get('room_artwork_details')?.[0] ?? 0,
      errors: rowsOf(reports[10])
        .filter((r) => r.dims[0] && r.dims[0] !== '(not set)')
        .map((r) => ({ reason: r.dims[0], count: r.metrics[0] })),
    },
    artworks: [...artworkMap]
      .map(([slug, v]) => ({ slug, ...v }))
      .filter((a) => a.viewers + a.configurator > 0)
      .sort((a, b) => b.viewers - a.viewers || b.configurator - a.configurator),
    sources: [...sourceMap]
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.sessions - a.sessions),
    landingPages: rowsOf(reports[14]).map((r) => ({
      path: r.dims[0],
      sessions: r.metrics[0],
      engaged: r.metrics[1],
    })),
  }
}
