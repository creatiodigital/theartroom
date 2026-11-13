'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  ArrowUUpLeft,
  Check,
  Flag,
  HandCoins,
  PaperPlaneTilt,
  Tray,
  type Icon,
} from '@phosphor-icons/react'

import { useAttentionCounts } from '@/components/admin/shell'
import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { AttentionCard } from '@/components/admin/ui/AttentionCard'
import { Panel, PanelLink } from '@/components/admin/ui/Panel'
import { PipelineList } from '@/components/admin/ui/PipelineList'
import { Button } from '@/components/ui/Button'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { clearAllTestData, getTestDataCounts } from '@/app/admin/dev-cleanup/actions'
import type { AttentionMetric, Bucket } from '@/lib/orders/orderBuckets'

// Dev/staging-only cleanup controls. NEXT_PUBLIC_APP_ENV is inlined at build
// time, so on production this is a compile-time false and the whole section
// (plus its imports' code paths) never renders. The server actions carry the
// authoritative guard — this flag is just UI.
import { DEV_CLEANUP_ALLOWED } from '@/lib/admin/devCleanup'

import {
  AnalyticsFootnote,
  AnalyticsStatePanel,
  ArtworkViewsPanel,
  CountriesPanel,
  TrafficChannelsPanel,
} from './AnalyticsPanels'
import { DevCleanupPanel } from './DevCleanupPanel'
import { PhoneStorefrontRow } from './PhoneStorefrontRow'
import { useDashboardAnalytics } from './useDashboardAnalytics'

import styles from './AdminDashboard.module.scss'

// Shown when an action never got an answer (timeout, offline, mid-deploy) —
// distinct from the action's own `error`, which means it ran and said no.
const UNREACHABLE = 'Could not reach the server.'

// Cards, pipeline rows and pills open the Orders page on the matching tab
// (?stage=, questions.md Q1).
const ORDERS_HREF = '/admin/orders'
const stageHref = (bucket: Bucket) => `${ORDERS_HREF}?stage=${bucket}`

// Counter cards surface what needs the admin's attention right now. Each
// carries a `metric` and reads its live count from countAttentionMetrics
// (same bucketOf logic as the orders tabs — single source of truth).
// Ordered by urgency: buyer-money / legal exposure first, payouts last.
// A card only takes its red/amber tone when its count > 0, so a clean row
// is all-gray and the eye lands on what needs action.
const URGENT_COUNTERS: {
  label: string
  metric: AttentionMetric
  icon: Icon
  tone: 'red' | 'amber'
  zeroHint: string
  /** The Orders tab these orders sit in (refund-owed orders are in Canceled). */
  stage: Bucket
}[] = [
  {
    label: 'Refund still owed',
    metric: 'refundOwed',
    icon: ArrowUUpLeft,
    tone: 'red',
    zeroHint: 'Nothing owed',
    stage: 'cancelled',
  },
  {
    label: 'Needs attention',
    metric: 'attention',
    icon: Flag,
    tone: 'red',
    zeroHint: 'No flagged orders',
    stage: 'attention',
  },
  {
    label: 'New',
    metric: 'new',
    icon: Tray,
    tone: 'amber',
    zeroHint: 'None to capture',
    stage: 'new',
  },
  {
    label: 'Awaiting placement at TPS',
    metric: 'toPlace',
    icon: PaperPlaneTilt,
    tone: 'amber',
    zeroHint: 'All placed',
    stage: 'to-place',
  },
  {
    label: 'Delivered, artist not paid',
    metric: 'deliveredUnpaid',
    icon: HandCoins,
    tone: 'amber',
    zeroHint: 'All artists paid',
    stage: 'delivered',
  },
]

// "Wednesday, 11 November 2026" on desktop, "Wed, 11 Nov 2026" on phone.
function formatToday(style: 'long' | 'short'): string {
  const now = new Date()
  const weekday = now.toLocaleDateString('en-GB', { weekday: style })
  const date = now.toLocaleDateString('en-GB', { day: 'numeric', month: style, year: 'numeric' })
  return `${weekday}, ${date}`
}

export const DashboardAdmin = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const attentionTitleId = useId()

  // Order numbers come from the admin shell (one read per visit, shared with
  // the menu badge); analytics from its own single request.
  const { metrics, buckets, error: countsError, reload: loadCounts } = useAttentionCounts()
  const analytics = useDashboardAnalytics()

  // Dev-cleanup state (section only renders outside production).
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false)
  const [cleanupCounts, setCleanupCounts] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const userType = session?.user?.userType
      if (userType !== 'admin' && userType !== 'superAdmin') {
        router.push('/')
      }
    }
  }, [sessionStatus, session, router])

  // Every action call on this page catches TRANSPORT failures too, not just
  // `ok: false`: a 504 or a rolling deploy rejects the promise before the
  // action's own try/catch runs. Uncaught, that surfaced in Sentry as
  // "An unexpected response was received from the server" — tagged with
  // whatever admin page was open by then, because Next queues actions and
  // posts each one to the CURRENT url, so a slow one outlives the dashboard.
  const openCleanupConfirm = useCallback(async () => {
    setCleanupResult(null)
    setCleanupCounts(null)
    setCleanupConfirmOpen(true)
    try {
      const res = await getTestDataCounts()
      setCleanupCounts(
        res.ok
          ? `${res.counts.printOrders} orders, ${res.counts.invoices} invoices, ` +
              `${res.counts.pendingCarts} staged carts, ${res.counts.editionNumbersHeld} held edition numbers`
          : res.error,
      )
    } catch {
      setCleanupCounts(UNREACHABLE)
    }
  }, [])

  const handleClearTestData = useCallback(async () => {
    setCleaning(true)
    let res: Awaited<ReturnType<typeof clearAllTestData>>
    try {
      res = await clearAllTestData()
    } catch {
      setCleanupResult(`Cleanup failed: ${UNREACHABLE} Reload to see what was cleared.`)
      return
    } finally {
      setCleaning(false)
      setCleanupConfirmOpen(false)
    }
    if (res.ok) {
      const s = res.summary
      setCleanupResult(
        `Cleared: ${s.printOrdersDeleted} orders, ${s.invoicesDeleted} invoices ` +
          `(${s.invoicePdfsDeleted} PDFs), ${s.pendingCartsDeleted} staged carts. ` +
          `${s.editionNumbersReset} edition numbers returned to the pool` +
          (s.editionSlotsBackfilled ? `, ${s.editionSlotsBackfilled} slots backfilled.` : '.'),
      )
      void loadCounts()
    } else {
      setCleanupResult(`Cleanup failed: ${res.error}`)
    }
  }, [loadCounts])

  if (sessionStatus === 'loading') return <LoadingBar />

  const userType = session?.user?.userType
  if (sessionStatus === 'unauthenticated' || (userType !== 'admin' && userType !== 'superAdmin')) {
    return <p className={styles.notAuthorized}>Not authorized</p>
  }

  const allClear =
    metrics !== null && URGENT_COUNTERS.every((counter) => metrics[counter.metric] === 0)

  return (
    <div className={styles.page}>
      <AdminPageHeader
        eyebrow={
          <>
            <span className={styles.dateLong}>{formatToday('long')}</span>
            <span className={styles.dateShort}>{formatToday('short')}</span>
          </>
        }
        title="Dashboard"
        description="What needs you today, where orders stand, and how the site is doing."
      />

      <PhoneStorefrontRow />

      <section aria-labelledby={attentionTitleId} className={styles.attention}>
        <div className={styles.attentionHead}>
          <h2 id={attentionTitleId} className={styles.sectionTitle}>
            Needs your attention
          </h2>
          {allClear && (
            <span className={styles.allClear}>
              <Check size={12} weight="bold" aria-hidden />
              All clear
            </span>
          )}
        </div>
        <div className={styles.cards}>
          {URGENT_COUNTERS.map((counter) => (
            <AttentionCard
              key={counter.metric}
              label={counter.label}
              icon={counter.icon}
              count={metrics ? metrics[counter.metric] : null}
              failed={countsError !== null}
              tone={counter.tone}
              zeroHint={counter.zeroHint}
              href={stageHref(counter.stage)}
            />
          ))}
        </div>
        {countsError && (
          <div className={styles.countsError}>
            <span aria-hidden className={styles.errorDot} />
            <span className={styles.countsErrorText}>{countsError}</span>
            <Button
              variant="bare"
              font="dashboard"
              className={styles.retry}
              label="Retry"
              onClick={() => void loadCounts()}
            />
          </div>
        )}
      </section>

      <div className={styles.row}>
        <Panel
          title="Order pipeline"
          subtitle="Every order by fulfillment stage"
          action={<PanelLink href={ORDERS_HREF}>All orders</PanelLink>}
        >
          <PipelineList buckets={buckets} stageHref={stageHref} />
        </Panel>
        {analytics?.ok && <TrafficChannelsPanel data={analytics.data} />}
      </div>

      {analytics?.ok ? (
        <>
          <div className={styles.row}>
            <ArtworkViewsPanel data={analytics.data} />
            <CountriesPanel data={analytics.data} />
          </div>
          <AnalyticsFootnote fetchedAt={analytics.data.fetchedAt} />
        </>
      ) : (
        <AnalyticsStatePanel result={analytics} />
      )}

      {DEV_CLEANUP_ALLOWED && (
        <DevCleanupPanel
          environment={process.env.NEXT_PUBLIC_APP_ENV ?? 'development'}
          result={cleanupResult}
          onClear={() => void openCleanupConfirm()}
        />
      )}

      {cleanupConfirmOpen && (
        <AdminConfirmModal
          title="Clear ALL test data?"
          message={
            <>
              <p>
                This deletes every order, invoice (register rows + PDFs), and staged cart, and
                returns every limited-edition number to the pool — on the SHARED dev database
                (localhost + staging together).
              </p>
              <p>{cleanupCounts ? `Right now that is: ${cleanupCounts}.` : 'Counting…'}</p>
            </>
          }
          confirmLabel="Yes, clear everything"
          busyLabel="Clearing…"
          destructive
          busy={cleaning}
          onConfirm={() => void handleClearTestData()}
          onCancel={() => setCleanupConfirmOpen(false)}
        />
      )}
    </div>
  )
}
