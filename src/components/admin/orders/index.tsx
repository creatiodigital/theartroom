'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CaretRight } from '@phosphor-icons/react'
import c from 'classnames'

import { useAttentionCounts } from '@/components/admin/shell'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Callout } from '@/components/admin/ui/Callout'
import { DataTable } from '@/components/admin/ui/DataTable'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { SearchField } from '@/components/admin/ui/SearchField'
import { StageTabs, type StageTab } from '@/components/admin/ui/StageTabs'
import { Button } from '@/components/ui/Button'
import { authorizationHold } from '@/lib/orders/authorizationPolicy'
import { type Bucket, BUCKET_ORDER, bucketOf } from '@/lib/orders/orderBuckets'
import { formatOrderRef, orderMatchesQuery } from '@/lib/orders/orderRef'
import { daysSinceDelivered, PAYOUT_SAFE_WINDOW_DAYS } from '@/lib/orders/payoutPolicy'
import { formatEuro } from '@/lib/print-providers/format'

import type { AdminOrderRow } from '@/app/admin/orders/actions'

import styles from './Orders.module.scss'

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

// The fulfillment pipeline (numbered tabs), then the off-ramps after a divider.
const STAGE_BUCKETS: Bucket[] = [
  'new',
  'to-place',
  'at-tps',
  'production',
  'shipped',
  'delivered',
  'done',
]
const OTHER_BUCKETS: Bucket[] = ['cancelled', 'refunded', 'attention']

function isBucket(value: string | null): value is Bucket {
  return value !== null && (BUCKET_ORDER as string[]).includes(value)
}

type BucketMeta = {
  label: string
  /** Callout: bold first sentence, then the rest. */
  title: string
  text: string
  tone: 'info' | 'plain' | 'amber' | 'red'
  /** The row's link to the order page. Every real action happens there. */
  action: string
  actionStyle: 'dark' | 'outline' | 'red'
  empty: [string, string]
}

// Copy from docs/admin-redesign/orders.md §1 and designs/orders.dc.html.
const BUCKET_META: Record<Bucket, BucketMeta> = {
  new: {
    label: 'New',
    title: 'Capture the payment first.',
    text: 'The buyer paid and the card is on hold. Once the capture succeeds the order moves to “To place at TPS”. Never place at TPS before capturing.',
    tone: 'amber',
    action: 'Capture payment',
    actionStyle: 'dark',
    empty: [
      'No new orders right now.',
      'New paid orders appear here as soon as a buyer checks out.',
    ],
  },
  'to-place': {
    label: 'To place at TPS',
    title: 'Place and pay the order at TPS.',
    text: 'Payment is captured, so you hold the buyer’s money. Order it on theprintspace, then mark it placed.',
    tone: 'info',
    action: 'Mark placed at TPS',
    actionStyle: 'dark',
    empty: [
      'Nothing to place.',
      'Captured orders wait here until you order them at theprintspace.',
    ],
  },
  'at-tps': {
    label: 'At TPS',
    title: 'Waiting for TPS.',
    text: 'Mark it in production once theprintspace confirms they are printing.',
    tone: 'info',
    action: 'Mark in production',
    actionStyle: 'dark',
    empty: [
      'Nothing waiting at TPS.',
      'Orders you placed at theprintspace wait here until printing starts.',
    ],
  },
  production: {
    label: 'In production',
    title: 'TPS is printing.',
    text: 'When they ship, add the tracking link and mark it shipped.',
    tone: 'info',
    action: 'Mark shipped',
    actionStyle: 'dark',
    empty: ['Nothing in production.', ''],
  },
  shipped: {
    label: 'Shipped',
    title: 'On its way.',
    text: 'Mark delivered once the buyer has it.',
    tone: 'info',
    action: 'Mark delivered',
    actionStyle: 'dark',
    empty: ['Nothing on its way.', ''],
  },
  delivered: {
    label: 'Delivered',
    title: 'Pay the artist.',
    text: `You can pay any time. The ${PAYOUT_SAFE_WINDOW_DAYS}-day count is only a hint for buyer-dispute risk.`,
    tone: 'info',
    action: 'Pay the artist',
    actionStyle: 'dark',
    empty: ['No artist waiting for payment.', ''],
  },
  done: {
    label: 'Artist paid',
    title: 'Complete.',
    text: 'Delivered and the artist is paid. Nothing left to do.',
    tone: 'plain',
    action: 'View',
    actionStyle: 'outline',
    empty: ['No completed orders yet.', ''],
  },
  cancelled: {
    label: 'Canceled',
    title: 'Pulled out before delivery.',
    text: 'Buyer canceled, TPS rejected the file, prints disabled… Refunds, if needed, are on the order page.',
    tone: 'plain',
    action: 'View',
    actionStyle: 'outline',
    empty: ['No canceled orders.', 'Orders stopped before delivery would show here.'],
  },
  refunded: {
    label: 'Refunded',
    title: 'Money returned.',
    text: 'The buyer was refunded. Nothing left to do.',
    tone: 'plain',
    action: 'View',
    actionStyle: 'outline',
    empty: ['No refunds.', ''],
  },
  attention: {
    label: 'Needs attention',
    title: 'Something went wrong.',
    text: 'Failed payments, rejected orders, refunds owed. Each case differs: open the order to sort it out.',
    tone: 'red',
    action: 'Resolve',
    actionStyle: 'red',
    empty: ['Nothing needs attention.', 'Failed payments and problems would show here.'],
  },
}

/**
 * How long this order's authorization has left, shown under its date.
 *
 * We authorize at checkout and capture at placement, so a "New" order is a
 * sale resting on a hold Stripe will void on its own. Once it lapses the buyer
 * is never charged and the copy goes back in the pool — silently, days after
 * anyone last looked. This is the only place an admin can see that clock while
 * the sale is still savable.
 *
 * Renders nothing for an order that holds no authorization, which is most of
 * them, so the column stays quiet everywhere it has nothing to say.
 */
const HoldCountdown = ({ order }: { order: AdminOrderRow }) => {
  const hold = authorizationHold(order)
  if (!hold) return null

  const urgent = hold.status !== 'fresh'
  const label =
    hold.status === 'expired'
      ? 'Hold expired'
      : // "~" is honest: 7 days is the CARD figure and we don't record the
        // method, so a PayPal hold (up to 20 days) is quoted short on purpose.
        `Hold ${days(hold.days)} · ~${days(hold.daysLeft)} left`

  return (
    <span
      title={
        hold.status === 'expired'
          ? 'Stripe has very likely voided this authorization already — a capture will fail. Cancel the order and ask the buyer to re-order.'
          : 'Authorizations lapse about 7 days after checkout. Capture the payment, or cancel and tell the buyer, before this runs out.'
      }
      className={c(styles.meta, urgent && styles.metaUrgent)}
    >
      {urgent && <span aria-hidden className={styles.redDot} />}
      {label}
    </span>
  )
}

// questions.md Q10: no field stores a reason, so it is derived from the row.
const attentionReason = (order: AdminOrderRow) =>
  order.paymentStatus === 'failed'
    ? 'Payment failed'
    : order.paymentStatus === 'canceled'
      ? 'Authorization canceled'
      : 'Needs a look'

const PayoutStatus = ({ order }: { order: AdminOrderRow }) => {
  if (order.payoutComplete) {
    return (
      <span className={styles.payout}>
        <span aria-hidden className={c(styles.dot, styles.dotGreen)} />
        {formatEuro(order.artistCents)}
        {order.payoutAt ? ` · ${formatDate(order.payoutAt)}` : ''}
        {order.payoutManual ? ' (manual)' : ''}
      </span>
    )
  }
  const since = daysSinceDelivered(order.shippedAt)
  if (since === null) return <span className={styles.muted}>—</span>
  const past = since >= PAYOUT_SAFE_WINDOW_DAYS
  const remaining = Math.max(0, PAYOUT_SAFE_WINDOW_DAYS - since)
  return (
    <span className={styles.payout}>
      <span aria-hidden className={c(styles.dot, past ? styles.dotGreen : styles.dotAmber)} />
      {since}d since delivered · {past ? 'safe window passed' : `${remaining}d to safe window`}
    </span>
  )
}

export const AdminOrders = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState('')

  // The rows come from the admin shell, which re-reads them on arriving here:
  // one listOrders() for the list, the tab counts and the menu badge (Q2).
  // While a re-read runs, the previous rows stay on screen.
  const { orders: shellOrders, error } = useAttentionCounts()
  const loading = shellOrders === null && error === null
  const orders = useMemo(() => shellOrders ?? [], [shellOrders])

  // The selected stage lives in the URL (?stage=), so the dashboard can link
  // straight to a tab and Back returns to it. Anything else falls back to New.
  const stageParam = searchParams.get('stage')
  const activeBucket: Bucket = isBucket(stageParam) ? stageParam : 'new'
  const selectStage = useCallback(
    (bucket: string) => {
      if (isBucket(bucket)) router.replace(`/admin/orders?stage=${bucket}`, { scroll: false })
    },
    [router],
  )

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const userType = session?.user?.userType
      if (userType !== 'admin' && userType !== 'superAdmin') router.push('/')
    }
  }, [sessionStatus, session, router])

  const grouped = useMemo(() => {
    const map: Record<Bucket, AdminOrderRow[]> = {
      new: [],
      'to-place': [],
      'at-tps': [],
      production: [],
      shipped: [],
      delivered: [],
      done: [],
      cancelled: [],
      refunded: [],
      attention: [],
    }
    for (const o of orders) {
      map[bucketOf(o)].push(o)
    }
    return map
  }, [orders])

  const trimmed = query.trim()
  const searching = trimmed.length > 0
  // A search deliberately ignores the bucket tabs: a buyer quoting a reference
  // has no idea whether their order is "New" or "Shipped", and hunting through
  // tabs is exactly the friction this box exists to remove.
  const visibleOrders = useMemo(
    () => (searching ? orders.filter((o) => orderMatchesQuery(o, query)) : grouped[activeBucket]),
    [searching, orders, query, grouped, activeBucket],
  )
  const meta = BUCKET_META[activeBucket]

  const toTab = (bucket: Bucket, step?: number): StageTab => {
    const count = grouped[bucket].length
    return {
      id: bucket,
      label: BUCKET_META[bucket].label,
      count,
      step,
      // Refunded only goes amber when there's *more than one* — a single
      // refund is unremarkable, multiples are a pattern worth flagging.
      countTone:
        bucket === 'attention' ? 'red' : bucket === 'refunded' && count > 1 ? 'amber' : undefined,
    }
  }

  // Column set follows the stage being looked at (a search shows the base set).
  const showShipped = !searching && (activeBucket === 'shipped' || activeBucket === 'delivered')
  const showPayout = !searching && (activeBucket === 'delivered' || activeBucket === 'done')
  const countLabel = `${visibleOrders.length} ${visibleOrders.length === 1 ? 'order' : 'orders'}`

  return (
    <div className={styles.page}>
      <AdminPageHeader
        eyebrow="Sales"
        title="Orders"
        description="Every buyer order, from payment to artist payout."
      />

      {error && <Callout tone="red">{error}</Callout>}

      <StageTabs
        label="Order stages"
        groups={[
          { label: 'Fulfillment stages', tabs: STAGE_BUCKETS.map((b, i) => toTab(b, i + 1)) },
          { label: 'Other', tabs: OTHER_BUCKETS.map((b) => toTab(b)) },
        ]}
        selected={searching ? null : activeBucket}
        onSelect={(id) => {
          setQuery('')
          selectStage(id)
        }}
      />

      {searching ? (
        <Callout tone="plain">
          {`${countLabel} matching “${trimmed}” — across every stage.`}
        </Callout>
      ) : (
        <Callout tone={meta.tone} title={meta.title}>
          {meta.text}
        </Callout>
      )}

      <section
        aria-label={searching ? 'Search results' : `${meta.label} orders`}
        className={styles.panel}
      >
        <div className={styles.toolbar}>
          <SearchField
            value={query}
            onChange={setQuery}
            label="Search orders"
            placeholder="Search reference, payment ID, buyer or artwork"
          />
          <span className={styles.count}>
            {countLabel}
            {searching && (
              <Button
                variant="bare"
                font="dashboard"
                className={styles.clear}
                label="Clear search"
                onClick={() => setQuery('')}
              />
            )}
          </span>
        </div>

        {loading ? (
          <p className={styles.loading}>Loading…</p>
        ) : visibleOrders.length === 0 ? (
          searching ? (
            <EmptyState
              title={`Nothing matches “${trimmed}”.`}
              text="Order references look like AD81E642; payment ids start with pi_."
            />
          ) : (
            <EmptyState title={meta.empty[0]} text={meta.empty[1] || undefined} />
          )
        ) : (
          <DataTable className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.colDate}>
                  Date
                </th>
                <th scope="col">Order</th>
                <th scope="col">Buyer</th>
                {showShipped && <th scope="col">Shipped</th>}
                {showPayout && <th scope="col">Artist payout</th>}
                <th scope="col" className={styles.alignRight}>
                  Total
                </th>
                <th scope="col" className={styles.alignRight}>
                  Next step
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((o) => {
                const bucket = searching ? bucketOf(o) : activeBucket
                const rowMeta = BUCKET_META[bucket]
                const href = `/admin/orders/${o.id}`
                return (
                  <tr key={o.id} className={styles.row}>
                    <td className={styles.cellDate}>
                      <span className={styles.date}>{formatDate(o.createdAt)}</span>
                      <HoldCountdown order={o} />
                      {bucket === 'attention' && (
                        <span className={c(styles.meta, styles.metaUrgent)}>
                          <span aria-hidden className={styles.redDot} />
                          {attentionReason(o)}
                        </span>
                      )}
                    </td>
                    <td className={styles.cellOrder}>
                      <Link href={href} className={styles.ref}>
                        {formatOrderRef(o.id)}
                      </Link>
                      {o.itemCount > 0 ? (
                        <>
                          {/* Say WHAT was bought, not just how many. An admin
                              chasing "the order that owns copy 1/100" has to be
                              able to see it from the list. */}
                          {o.itemSummaries.slice(0, 3).map((it, i) => (
                            <div key={i} className={styles.item}>
                              {it.artworkTitle ?? 'Artwork'}
                              {it.editionName && (
                                <span className={styles.muted}> · {it.editionName}</span>
                              )}
                              {it.editionLabels.length > 0 && (
                                <span className={styles.edition}>
                                  {' '}
                                  #{it.editionLabels.join(', #')}
                                </span>
                              )}
                              {it.editionLabels.length === 0 && it.quantity > 1 && (
                                <span className={styles.muted}> × {it.quantity}</span>
                              )}
                            </div>
                          ))}
                          {o.itemSummaries.length > 3 && (
                            <div className={styles.more}>+{o.itemSummaries.length - 3} more</div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className={styles.item}>
                            {o.artwork.title ?? o.artwork.slug ?? o.artwork.id}
                          </div>
                          <div className={styles.more}>{o.artist.name}</div>
                        </>
                      )}
                      {o.reorderCount > 0 && (
                        <span className={styles.replacement}>
                          Replacement{o.reorderCount > 1 ? ` ×${o.reorderCount}` : ''}
                        </span>
                      )}
                    </td>
                    <td className={styles.cellBuyer}>
                      <div className={styles.buyer}>{o.buyerName}</div>
                      <div className={styles.email}>{o.buyerEmail}</div>
                    </td>
                    {showShipped && (
                      <td className={styles.cellShipped}>
                        {o.shippedAt ? formatDate(o.shippedAt) : '—'}
                      </td>
                    )}
                    {showPayout && (
                      <td className={styles.cellPayout}>
                        <PayoutStatus order={o} />
                      </td>
                    )}
                    <td className={styles.cellTotal}>{formatEuro(o.totalCents)}</td>
                    <td className={styles.cellAction}>
                      {/* The row's only action is a doorway to the detail page —
                          every real workflow action (capture, mark in production,
                          refund, pay artist, and deleting the order) fires there,
                          with full context, so an accidental table tap can't trip
                          them. */}
                      <Link
                        href={href}
                        className={c(styles.next, styles[`next_${rowMeta.actionStyle}`])}
                      >
                        {rowMeta.action}
                        <CaretRight size={14} weight="bold" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
        )}
      </section>
    </div>
  )
}
