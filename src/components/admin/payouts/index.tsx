'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, DownloadSimple, HandCoins } from '@phosphor-icons/react'
import c from 'classnames'

import { useAttentionCounts } from '@/components/admin/shell'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { AdminSelect } from '@/components/admin/ui/AdminSelect'
import { Callout } from '@/components/admin/ui/Callout'
import { DataTable } from '@/components/admin/ui/DataTable'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { ListPanel } from '@/components/admin/ui/ListPanel'
import { StatCard } from '@/components/admin/ui/StatCard'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { formatOrderRef } from '@/lib/orders/orderRef'
import { payoutsCsvFilename, payoutsToCsv } from '@/lib/payouts/payoutCsv'
import { formatEuro } from '@/lib/print-providers/format'

import { listArtistPayouts, type AdminPayoutRow } from '@/app/admin/orders/actions'

import styles from './Payouts.module.scss'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// ── Filters (plan Decisions 2–4) ─────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()

/** The payout's local calendar year: the same day the row shows. */
const payoutYear = (p: AdminPayoutRow) => new Date(p.paidOutAt).getFullYear()

/** One artist per email; by name when there is no email. */
const artistKey = (p: AdminPayoutRow) =>
  p.artistEmail ? `email:${p.artistEmail}` : `name:${p.artistName}`

type ArtistOption = { key: string; name: string; label: string }

/** Every artist in the data, by name; two artists with one name get their email too. */
const toArtistOptions = (payouts: AdminPayoutRow[]): ArtistOption[] => {
  const byKey = new Map<string, { key: string; name: string; email: string | null }>()
  for (const p of payouts) {
    const key = artistKey(p)
    if (!byKey.has(key)) byKey.set(key, { key, name: p.artistName, email: p.artistEmail })
  }
  const artists = [...byKey.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || (a.email ?? '').localeCompare(b.email ?? ''),
  )
  const sameName = (name: string) => artists.filter((a) => a.name === name).length > 1
  return artists.map((a) => ({
    key: a.key,
    name: a.name,
    label: a.email && sameName(a.name) ? `${a.name} (${a.email})` : a.name,
  }))
}

/** The current year first, then every other year in the data, newest first. */
const toYearOptions = (payouts: AdminPayoutRow[]): number[] => {
  const years = new Set(payouts.map(payoutYear))
  years.delete(CURRENT_YEAR)
  return [CURRENT_YEAR, ...[...years].sort((a, b) => b - a)]
}

// ── Method column (plan Decision 5) ──────────────────────────────────────────

/** "tr_1Q8xAbCdEfGhIjKlMnF2aB" → "tr_1Q8xAbC…F2aB" (first 10, last 4). */
const shortTransferId = (id: string) => (id.length > 15 ? `${id.slice(0, 10)}…${id.slice(-4)}` : id)

// ── Main component ────────────────────────────────────────────────────────────

export const AdminPayouts = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const { metrics } = useAttentionCounts()

  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // null = all years; '' = all artists.
  const [yearFilter, setYearFilter] = useState<number | null>(CURRENT_YEAR)
  const [artistFilter, setArtistFilter] = useState('')

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const t = session?.user?.userType
      if (t !== 'admin' && t !== 'superAdmin') router.push('/')
    }
  }, [sessionStatus, session, router])

  const load = useCallback(async () => {
    setError(null)
    const res = await listArtistPayouts()
    if (res.ok) setPayouts(res.payouts)
    else setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (sessionStatus === 'authenticated') load()
  }, [sessionStatus, load])

  // ── Derived view ────────────────────────────────────────────────────────────
  const yearOptions = useMemo(() => toYearOptions(payouts), [payouts])
  const artistOptions = useMemo(() => toArtistOptions(payouts), [payouts])
  const selectedArtist = artistOptions.find((a) => a.key === artistFilter) ?? null

  // Decision 4: the cards, the count, the totals row and the CSV all read these rows.
  const shown = useMemo(
    () =>
      payouts.filter(
        (p) =>
          (yearFilter == null || payoutYear(p) === yearFilter) &&
          (!artistFilter || artistKey(p) === artistFilter),
      ),
    [payouts, yearFilter, artistFilter],
  )

  const totals = useMemo(() => {
    const artists = new Set(shown.map(artistKey))
    const viaStripe = shown.filter((p) => p.transferId).length
    return {
      cents: shown.reduce((sum, p) => sum + p.amountCents, 0),
      artists: artists.size,
      viaStripe,
      manual: shown.length - viaStripe,
    }
  }, [shown])

  // Nothing was ever read: the list gives way to the error (Decision 9).
  const loadFailed = !loading && error !== null && payouts.length === 0
  const totalsKnown = !loading && !loadFailed

  // Hidden while the shell's counts are unknown (null) or zero.
  const waiting = metrics?.deliveredUnpaid ?? 0

  // ── CSV export (Decision 8): built here from the rows on screen ────────────
  const handleExportCsv = () => {
    const blob = new Blob([payoutsToCsv(shown)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = payoutsCsvFilename(yearFilter, selectedArtist?.name ?? null)
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <AdminPageHeader
        eyebrow="Sales"
        title="Payouts"
        description="Every payout released to an artist, for tax records and accounting. Newest first."
        actions={
          <Button
            variant="bare"
            font="dashboard"
            className={styles.export}
            disabled={loading || shown.length === 0}
            onClick={handleExportCsv}
          >
            <DownloadSimple size={16} weight="light" aria-hidden />
            Export CSV
          </Button>
        }
      />

      {waiting > 0 && (
        <Callout
          tone="amber"
          icon={HandCoins}
          title={
            waiting === 1
              ? '1 delivered order is waiting for its artist payout.'
              : `${waiting} delivered orders are waiting for their artist payout.`
          }
          action={
            <Link href="/admin/orders?stage=delivered" className={styles.reminderLink}>
              Open Delivered orders
              <ArrowRight size={16} weight="light" aria-hidden />
            </Link>
          }
        >
          {waiting === 1 ? 'Pay it from the order page.' : 'Pay them from the order page.'}
        </Callout>
      )}

      <section aria-label="Summary" className={styles.cards}>
        <StatCard
          label="Released"
          size="money"
          value={totalsKnown ? formatEuro(totals.cents) : null}
          hint={yearFilter == null ? 'all time' : `in ${yearFilter}`}
        />
        <StatCard
          label="Payouts"
          // 28px like the money card beside it (Q32).
          size="money"
          value={totalsKnown ? shown.length : null}
          hint={totalsKnown ? plural(totals.artists, 'artist', 'artists') : undefined}
        />
        <StatCard
          label="Via Stripe"
          size="money"
          value={totalsKnown ? totals.viaStripe : null}
          hint={totalsKnown ? `${totals.manual} paid manually` : undefined}
        />
      </section>

      {error && <Callout tone="red">{error}</Callout>}

      <ListPanel
        label="Payouts"
        toolbar={
          <div className={styles.filters}>
            <AdminSelect
              label="Year"
              hideLabel
              id="payout-year"
              value={yearFilter == null ? '' : String(yearFilter)}
              onChange={(value) => setYearFilter(value ? Number(value) : null)}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
              <option value="">All years</option>
            </AdminSelect>

            <AdminSelect
              label="Artist"
              hideLabel
              id="payout-artist"
              minWidth={200}
              value={artistFilter}
              onChange={setArtistFilter}
            >
              <option value="">All artists</option>
              {artistOptions.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </AdminSelect>
          </div>
        }
        count={payouts.length > 0 ? plural(shown.length, 'payout', 'payouts') : undefined}
      >
        {(() => {
          if (loading) return <p className={styles.loading}>Loading…</p>
          if (loadFailed) return null
          if (payouts.length === 0) return <EmptyState title="No artist payouts released yet." />
          if (shown.length === 0) return <EmptyState title="No payouts match these filters." />
          return (
            <DataTable className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date paid</th>
                  <th scope="col">Artist</th>
                  <th scope="col">Artwork</th>
                  <th scope="col">Method</th>
                  <th scope="col" className={styles.alignRight}>
                    Amount
                  </th>
                  <th scope="col" className={styles.alignRight}>
                    Order
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.rowKey} className={styles.row}>
                    <td className={styles.cellDate}>{formatDate(p.paidOutAt)}</td>
                    <td className={styles.cellArtist}>
                      <div className={styles.artist}>{p.artistName}</div>
                      {p.artistEmail && <div className={styles.email}>{p.artistEmail}</div>}
                    </td>
                    <td className={styles.cellArtwork}>
                      <span className={styles.artwork}>{p.artworkTitle}</span>
                      {/* Cart orders contribute one row per line — flag the
                          source so a multi-row order reads clearly. */}
                      {p.source === 'item' && <span className={styles.cartLine}> · cart line</span>}
                    </td>
                    <td className={styles.cellMethod}>
                      {p.transferId ? (
                        <>
                          <StatusPill label="Stripe" tone="info" shape="tag" />
                          <div className={styles.transfer} title={p.transferId}>
                            {shortTransferId(p.transferId)}
                          </div>
                        </>
                      ) : (
                        <StatusPill label="Manual" tone="gray" shape="tag" />
                      )}
                    </td>
                    <td className={c(styles.amount, styles.cellAmount)}>
                      {formatEuro(p.amountCents)}
                    </td>
                    <td className={styles.cellOrder}>
                      <Link href={`/admin/orders/${p.orderId}`} className={styles.ref}>
                        <span className={styles.phoneOnly}>Order </span>
                        {formatOrderRef(p.orderId)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.footRow}>
                  <th scope="row" colSpan={4} className={styles.footLabel}>
                    {yearFilter == null ? 'Total released' : `Total released in ${yearFilter}`}
                  </th>
                  <td className={c(styles.amount, styles.cellAmount, styles.footTotal)}>
                    {formatEuro(totals.cents)}
                  </td>
                  <td className={styles.footEmpty} />
                </tr>
              </tfoot>
            </DataTable>
          )
        })()}
      </ListPanel>
    </div>
  )
}
