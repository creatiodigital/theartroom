'use client'

import { useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import c from 'classnames'

import type { AnalyticsPageResult } from '@/app/admin/analytics/report'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { BarList } from '@/components/admin/ui/BarList'
import { Panel } from '@/components/admin/ui/Panel'
import { SegmentedControl } from '@/components/admin/ui/SegmentedControl'
import { StatCard } from '@/components/admin/ui/StatCard'
import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type AnalyticsSplit,
} from '@/lib/analytics/reportShape'

import { FunnelChart } from './FunnelChart'
import { LineChart } from './LineChart'
import {
  checkoutErrorLabel,
  formatChange,
  formatDuration,
  formatNumber,
  formatPercent,
  pageLabel,
  roomErrorLabel,
  segmentColor,
} from './format'

import styles from './AdminAnalytics.module.scss'

const SPLIT_OPTIONS: { id: AnalyticsSplit; label: string }[] = [
  { id: 'device', label: 'Device' },
  { id: 'country', label: 'Country' },
  { id: 'source', label: 'Source' },
  { id: 'visitor', label: 'New or returning' },
]

const RANGE_OPTIONS = ANALYTICS_RANGES.map((days) => ({ id: String(days), label: `${days} days` }))

/** The checkout and 3D-room events went live with release 3.15.1. */
const EVENTS_SINCE = '18 Nov 2026'

type AdminAnalyticsProps = {
  result: AnalyticsPageResult
  range: AnalyticsRange
  split: AnalyticsSplit
}

/**
 * Admin · Analytics: who visits, where they come from and how far they get towards an order, for
 * one period and split one way (filters on top scope every panel). Data: GA4, read on the server
 * (src/app/admin/analytics/report.ts). Built ahead of a design (questions.md, Q-AN1).
 */
export function AdminAnalytics({ result, range, split }: AdminAnalyticsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const go = (next: { range?: AnalyticsRange; split?: AnalyticsSplit }) => {
    const params = new URLSearchParams({
      range: String(next.range ?? range),
      split: next.split ?? split,
    })
    startTransition(() => router.push(`${pathname}?${params}`, { scroll: false }))
  }

  const periodLabel = `${range} days`

  const filters = (
    <div className={styles.filters}>
      <SegmentedControl
        label="Period"
        options={RANGE_OPTIONS}
        value={String(range)}
        onChange={(id) => go({ range: Number(id) as AnalyticsRange })}
      />
      <SegmentedControl
        label="Split visitors by"
        options={SPLIT_OPTIONS}
        value={split}
        onChange={(id) => go({ split: id })}
      />
    </div>
  )

  const header = (
    <AdminPageHeader
      title="Analytics"
      description="Who visits, where they come from, and how far they get towards an order."
    />
  )

  if (!result.ok) {
    return (
      <div className={styles.page}>
        {header}
        {filters}
        <Panel title={result.notConfigured ? 'Setup needed' : 'Unavailable'}>
          <p className={styles.note}>{result.error}</p>
        </Panel>
      </div>
    )
  }

  const data = result.data
  const segments = data.segments.map((label) => ({
    label,
    color: segmentColor(label, data.segments),
  }))
  const step = (id: string) => data.funnel.find((s) => s.id === id)
  const artworkStep = step('artwork')
  const configuratorStep = step('configurator')
  const orderStep = step('order')
  const updated = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date(data.fetchedAt))
  const room = data.room
  const roomEventsYet = room.loaded + room.leftWhileLoading > 0
  const engagedShare = (engaged: number, sessions: number) =>
    sessions ? `${formatPercent(engaged / sessions)} stayed and looked around` : undefined

  return (
    <div className={c(styles.page, pending && styles.pending)} aria-busy={pending}>
      {header}
      {filters}

      <div className={styles.stats}>
        <StatCard
          label="Visitors"
          value={formatNumber(data.totals.visitors.current)}
          hint={formatChange(
            data.totals.visitors.current,
            data.totals.visitors.previous,
            periodLabel,
          )}
        />
        <StatCard
          label="Visits"
          value={formatNumber(data.totals.sessions.current)}
          hint={formatChange(
            data.totals.sessions.current,
            data.totals.sessions.previous,
            periodLabel,
          )}
        />
        <StatCard
          label="Engaged visits"
          value={formatPercent(data.totals.engagement.current)}
          hint="Stayed 10 s+, or saw 2+ pages"
        />
        <StatCard
          label="Saw an artwork"
          value={formatNumber(artworkStep?.total ?? 0)}
          hint={artworkStep && formatChange(artworkStep.total, artworkStep.previous, periodLabel)}
        />
        <StatCard
          label="Opened the configurator"
          value={formatNumber(configuratorStep?.total ?? 0)}
          hint={
            configuratorStep &&
            formatChange(configuratorStep.total, configuratorStep.previous, periodLabel)
          }
        />
        <StatCard
          label="Orders"
          value={formatNumber(orderStep?.total ?? 0)}
          hint={orderStep && formatChange(orderStep.total, orderStep.previous, periodLabel)}
        />
      </div>

      <Panel
        title="Visits per day"
        subtitle={`Split by ${SPLIT_OPTIONS.find((o) => o.id === split)?.label.toLowerCase()}`}
      >
        <LineChart
          dates={data.daily.map((d) => d.date)}
          series={segments.map((s) => ({
            key: s.label,
            label: s.label,
            color: s.color,
            values: data.daily.map((d) => d.values[s.label] ?? 0),
          }))}
          unit="visits"
          label={`Visits per day over the last ${periodLabel}, one line per ${split}`}
        />
      </Panel>

      <Panel
        title="The way to an order"
        subtitle="People who reached each step. Hover a colour for its number."
      >
        <FunnelChart steps={data.funnel} segments={segments} periodLabel={periodLabel} />
      </Panel>

      <div className={styles.pair}>
        <Panel
          title="What stops buyers"
          subtitle={`Checkout errors, by step and reason (since ${EVENTS_SINCE})`}
        >
          <BarList
            rows={data.checkoutErrors.map((e) => ({
              key: `${e.step}-${e.reason}`,
              label: checkoutErrorLabel(e.step, e.reason),
              value: e.count,
            }))}
            emptyMessage="No checkout errors in this period."
          />
        </Panel>

        <Panel
          title="3D room"
          subtitle={`Rooms opened, and how visits went (since ${EVENTS_SINCE})`}
        >
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>Opened a room</dt>
              <dd>{formatNumber(room.visitors)}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Left while it loaded</dt>
              <dd>
                {roomEventsYet
                  ? `${formatNumber(room.leftWhileLoading)} (${formatPercent(
                      room.leftWhileLoading / (room.loaded + room.leftWhileLoading),
                    )})`
                  : '–'}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>Typical load time</dt>
              <dd>{room.avgLoadMs !== null ? formatDuration(room.avgLoadMs) : '–'}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Time in the room</dt>
              <dd>
                {room.avgSecondsInRoom !== null
                  ? formatDuration(room.avgSecondsInRoom * 1000)
                  : '–'}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>Works looked at</dt>
              <dd>{room.avgWorksViewed !== null ? room.avgWorksViewed.toFixed(1) : '–'}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Details opened</dt>
              <dd>{roomEventsYet ? formatNumber(room.detailsOpened) : '–'}</dd>
            </div>
          </dl>
          <BarList
            rows={segments.map((s) => ({
              key: s.label,
              label: s.label,
              value: room.visitorsBySegment[s.label] ?? 0,
            }))}
            emptyMessage="Nobody opened a room in this period."
          />
          {room.errors.length > 0 && (
            <BarList
              rows={room.errors.map((e) => ({
                key: e.reason,
                label: roomErrorLabel(e.reason),
                value: e.count,
              }))}
              emptyMessage=""
            />
          )}
        </Panel>
      </div>

      <div className={styles.pair}>
        <Panel
          title="Artworks"
          subtitle="People on each artwork page, and how many opened its configurator"
        >
          <BarList
            variant="table"
            columns={{ label: 'Artwork', share: '', value: 'People' }}
            rows={data.artworks.map((a) => ({
              key: a.slug,
              label: a.title,
              sublabel: `${a.artistName} · ${a.configurator} opened the configurator`,
              value: a.viewers,
            }))}
            emptyMessage="No artwork views in this period."
          />
        </Panel>

        <Panel title="Where visitors come from" subtitle="Visits by source">
          <BarList
            variant="table"
            columns={{ label: 'Source', share: '', value: 'Visits' }}
            rows={data.sources.slice(0, 8).map((s) => ({
              key: s.source,
              label: s.source,
              sublabel: engagedShare(s.engaged, s.sessions),
              value: s.sessions,
            }))}
            emptyMessage="No visits in this period."
          />
        </Panel>
      </div>

      <Panel title="Where visits start" subtitle="The first page of each visit">
        <BarList
          variant="table"
          columns={{ label: 'Page', share: '', value: 'Visits' }}
          rows={data.landingPages.map((p) => ({
            key: p.path,
            label: pageLabel(p.path),
            sublabel: engagedShare(p.engaged, p.sessions),
            value: p.sessions,
          }))}
          emptyMessage="No visits in this period."
        />
      </Panel>

      <p className={styles.note}>
        Google Analytics, live site. Visits the site marks as internal (signed-in admins and
        artists) are left out. GA4 counts mostly visitors who accepted cookies, so read trends
        rather than exact counts. Checkout and 3D-room events since {EVENTS_SINCE}. Updated{' '}
        {updated}.
      </p>
    </div>
  )
}
