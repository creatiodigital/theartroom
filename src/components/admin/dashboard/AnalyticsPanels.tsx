'use client'

import type { AnalyticsResult, DashboardAnalytics } from '@/app/admin/analytics/actions'
import { BarList } from '@/components/admin/ui/BarList'
import { DonutChart } from '@/components/admin/ui/DonutChart'
import { Panel } from '@/components/admin/ui/Panel'

import styles from './AdminDashboard.module.scss'

const NO_SESSIONS = 'No sessions recorded yet.'

export function TrafficChannelsPanel({ data }: { data: DashboardAnalytics }) {
  return (
    <Panel title="Traffic channels" subtitle="How visitors reached the site · last 30 days">
      {data.channels.length === 0 ? (
        <p className={styles.empty}>{NO_SESSIONS}</p>
      ) : (
        <DonutChart
          title="Traffic channels"
          totalLabel="sessions"
          segments={data.channels.map((c) => ({ label: c.channel, value: c.sessions }))}
        />
      )}
    </Panel>
  )
}

export function ArtworkViewsPanel({ data }: { data: DashboardAnalytics }) {
  return (
    <Panel title="Most viewed artworks" subtitle="Page views · last 30 days">
      <BarList
        variant="table"
        columns={{ label: 'Artwork', share: 'Share', value: 'Views' }}
        emptyMessage="No artwork views recorded yet."
        rows={data.topArtworks.map((a) => ({
          key: a.slug,
          label: a.title,
          sublabel: (
            <>
              {a.artistName}
              {!a.sellsPrints && (
                <>
                  {' · '}
                  <span className={styles.noPrints}>no prints</span>
                </>
              )}
            </>
          ),
          value: a.views,
        }))}
      />
    </Panel>
  )
}

export function CountriesPanel({ data }: { data: DashboardAnalytics }) {
  return (
    <Panel title="Visitors by country" subtitle="Top 10 · last 30 days">
      <BarList
        emptyMessage={NO_SESSIONS}
        rows={data.countries.map((c) => ({ key: c.country, label: c.country, value: c.sessions }))}
      />
    </Panel>
  )
}

/**
 * Loading, not configured and failed share one full-width panel in place of
 * all the analytics panels: they come from one request (dashboard-states §5).
 */
export function AnalyticsStatePanel({ result }: { result: AnalyticsResult | null }) {
  if (result === null) {
    return (
      <section aria-busy="true" className={styles.analyticsState}>
        <h2 className="sr-only">Site analytics</h2>
        <span aria-hidden className={`${styles.skeleton} ${styles.skeletonTitle}`} />
        <span aria-hidden className={styles.skeleton} />
        <span aria-hidden className={`${styles.skeleton} ${styles.skeleton80}`} />
        <span aria-hidden className={`${styles.skeleton} ${styles.skeleton65}`} />
        <span aria-hidden className={`${styles.skeleton} ${styles.skeleton40}`} />
        <span className={styles.stateHint}>Loading analytics…</span>
      </section>
    )
  }
  if (result.ok) return null

  return (
    <section className={styles.analyticsState}>
      <h2 className="sr-only">Site analytics</h2>
      <span
        className={`${styles.stateBadge} ${result.notConfigured ? styles.badgeInfo : styles.badgeDanger}`}
      >
        {result.notConfigured ? 'Setup needed' : 'Unavailable'}
      </span>
      <p className={styles.stateText}>
        {result.notConfigured
          ? 'GA4 is not configured — set GA4_PROPERTY_ID and GA_SERVICE_ACCOUNT_KEY to enable this section.'
          : result.error}
      </p>
    </section>
  )
}

export function AnalyticsFootnote({ fetchedAt }: { fetchedAt: string }) {
  const updated = new Date(fetchedAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return (
    <p className={styles.footnote}>
      Analytics: production traffic via Google Analytics, consenting visitors plus Google&rsquo;s
      modeling, so read them as trends, not a census. Updated {updated}.
    </p>
  )
}
