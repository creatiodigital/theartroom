'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp } from '@phosphor-icons/react'
import c from 'classnames'

import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { AdminSelect } from '@/components/admin/ui/AdminSelect'
import { Callout } from '@/components/admin/ui/Callout'
import { DataTable } from '@/components/admin/ui/DataTable'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { ListPanel } from '@/components/admin/ui/ListPanel'
import { OffPlatformKindMark } from '@/components/admin/ui/OffPlatformKindMark'
import { StatCard } from '@/components/admin/ui/StatCard'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SelectDropdown } from '@/components/ui/SelectDropdown'

import {
  createOffPlatformOrder,
  listEditionSales,
  listGiftableVariants,
  releaseOrphanedEditionNumber,
  type EditionSaleRow,
  type GiftableVariantRow,
} from '@/app/admin/orders/actions'
import {
  OFF_PLATFORM_KINDS,
  OFF_PLATFORM_KIND_LABELS,
  type OffPlatformKind,
} from '@/lib/orders/offPlatformKinds'

import { formatOrderRef } from '@/lib/orders/orderRef'

import styles from './EditionSales.module.scss'

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      })
    : '—'

const PAGE_PATH = '/admin/edition-sales'

const copies = (n: number) => `${n} ${n === 1 ? 'copy' : 'copies'}`

// The Status filter and the summary cards (sales.md §1). One status per copy,
// so the three add up to the ledger: a copy consumed by hand is off-platform
// whatever its stored state.
const STATUS_FILTERS = ['sold', 'reserved', 'off-platform'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const STATUS_META: Record<StatusFilter, { label: string; tone: 'green' | 'amber' | 'info' }> = {
  sold: { label: 'Sold', tone: 'green' },
  reserved: { label: 'Reserved', tone: 'amber' },
  // questions.md Q17: the pill names the group; the Holder column names the kind.
  'off-platform': { label: 'Off-platform', tone: 'info' },
}

const isStatusFilter = (value: string | null): value is StatusFilter =>
  value !== null && (STATUS_FILTERS as readonly string[]).includes(value)

const statusOf = (s: EditionSaleRow): StatusFilter =>
  s.offPlatformKind ? 'off-platform' : s.state === 'reserved' ? 'reserved' : 'sold'

/** A column header that cycles descending → ascending → unsorted. The button
 *  is named by the column; `aria-sort` on the cell carries the direction. */
const SortHeader = ({
  label,
  active,
  onClick,
  lead,
}: {
  label: string
  active: 'asc' | 'desc' | null
  onClick: () => void
  /** Phone-only text before the button ("Sort by", "·"): the header row is the sort bar there. */
  lead?: string
}) => (
  <th
    scope="col"
    aria-sort={active === 'desc' ? 'descending' : active === 'asc' ? 'ascending' : undefined}
    className={c(styles.sortable, active && styles.sorted)}
  >
    {lead && (
      <span aria-hidden className={styles.sortLead}>
        {lead}
      </span>
    )}
    <Button variant="bare" font="dashboard" className={styles.sortButton} onClick={onClick}>
      {label}
      {active === 'desc' && <ArrowDown size={12} weight="light" aria-hidden />}
      {active === 'asc' && <ArrowUp size={12} weight="light" aria-hidden />}
    </Button>
  </th>
)

type SortState = { key: 'date' | 'number'; dir: 'asc' | 'desc' } | null

/** Clicking a column steps it descending → ascending → off. Clicking a
 *  different column starts that one descending, since the newest or highest is
 *  what the page is usually asked for. */
const cycleSort = (current: SortState, key: 'date' | 'number'): SortState => {
  if (current?.key !== key) return { key, dir: 'desc' }
  if (current.dir === 'desc') return { key, dir: 'asc' }
  return null
}

/**
 * Admin ledger of every numbered limited-edition copy that's been
 * reserved or sold — which number, to whom, for which artwork + variant,
 * and whether it's been mirrored as sold in TPS. Our authoritative record.
 */
export const AdminEditionSales = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  // Deep link from a variant card ("Create gift order"): ?gift=<variantId>
  // auto-opens the modal with that variant preselected, once.
  const searchParams = useSearchParams()
  const giftParamHandled = useRef(false)
  const giftParam = searchParams.get('gift')

  const [sales, setSales] = useState<EditionSaleRow[]>([])

  // Narrow to one edition, then read it in numeric order — the question this
  // page exists to answer is "which copy went last", and across every artwork
  // at once that is unreadable. The filters live in the URL (?artwork=,
  // ?variant=, ?status=) so a filtered view can be linked and survives Back;
  // the sort stays on the page.
  const artworkFilter = searchParams.get('artwork') ?? ''
  // A variant only means something inside its artwork (names repeat), so a
  // variant without an artwork is ignored, as is an unknown status.
  const variantFilter = artworkFilter ? (searchParams.get('variant') ?? '') : ''
  const statusParam = searchParams.get('status')
  const statusFilter: StatusFilter | '' = isStatusFilter(statusParam) ? statusParam : ''
  const [sort, setSort] = useState<{ key: 'date' | 'number'; dir: 'asc' | 'desc' } | null>(null)

  // The one writer of the filter params. ?gift= rides along untouched: its
  // effect below runs once per visit, so keeping it never reopens the form.
  const setFilters = useCallback(
    (next: { artwork?: string; variant?: string; status?: StatusFilter | '' }) => {
      const params = new URLSearchParams()
      if (giftParam) params.set('gift', giftParam)
      if (next.artwork) params.set('artwork', next.artwork)
      if (next.artwork && next.variant) params.set('variant', next.variant)
      if (next.status) params.set('status', next.status)
      const query = params.toString()
      router.replace(query ? `${PAGE_PATH}?${query}` : PAGE_PATH, { scroll: false })
    },
    [giftParam, router],
  )

  // Keyed by slug, not title: two artists can name a work the same thing.
  const artworkOptions = useMemo(() => {
    const byKey = new Map<string, string>()
    for (const s of sales) {
      const key = s.artworkSlug ?? s.artworkTitle
      if (!byKey.has(key)) byKey.set(key, `${s.artworkTitle} — ${s.artistName}`)
    }
    return [...byKey].sort((a, b) => a[1].localeCompare(b[1]))
  }, [sales])

  // Only ever the chosen artwork's variants. Variant names are NOT unique
  // across artworks — "Small 20" can exist on several — so offering them in one
  // flat list would silently mix editions that have nothing to do with each
  // other, which is exactly the confusion this page is meant to end.
  const variantOptions = useMemo(() => {
    if (!artworkFilter) return []
    const names = new Set(
      sales
        .filter((s) => (s.artworkSlug ?? s.artworkTitle) === artworkFilter)
        .map((s) => s.variantName),
    )
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [sales, artworkFilter])

  const visibleSales = useMemo(() => {
    let rows = sales
    if (artworkFilter) {
      rows = rows.filter((s) => (s.artworkSlug ?? s.artworkTitle) === artworkFilter)
    }
    if (variantFilter) rows = rows.filter((s) => s.variantName === variantFilter)
    if (statusFilter) rows = rows.filter((s) => statusOf(s) === statusFilter)
    if (sort) {
      const dir = sort.dir === 'asc' ? 1 : -1
      // Copied before sorting: `sales` is state and must not be mutated.
      rows = [...rows].sort((a, b) => {
        if (sort.key === 'number') return (a.number - b.number) * dir
        // Undated rows sink to the bottom whichever way the column is pointing,
        // rather than pretending to be the oldest.
        if (!a.date) return 1
        if (!b.date) return -1
        return (Date.parse(a.date) - Date.parse(b.date)) * dir
      })
    }
    return rows
  }, [sales, artworkFilter, variantFilter, statusFilter, sort])

  // The summary cards count the whole loaded ledger, never the filtered view.
  const counts = useMemo(() => {
    const totals = { sold: 0, reserved: 0, offPlatform: 0, notMirrored: 0 }
    for (const s of sales) {
      const status = statusOf(s)
      if (status === 'sold') totals.sold += 1
      else if (status === 'reserved') totals.reserved += 1
      else totals.offPlatform += 1
      // "Mirrored" is stored per order, so only a sold copy with an order can
      // carry it: reserved and off-platform copies never count here (Q18).
      if (s.state === 'sold' && s.orderId && !s.mirroredInTps) totals.notMirrored += 1
    }
    return totals
  }, [sales])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Per-row release (manual cleanup of orphaned, order-less reservations —
  // frees the number back to available without removing the slot).
  const [releaseTarget, setReleaseTarget] = useState<EditionSaleRow | null>(null)
  const [releasing, setReleasing] = useState(false)
  const [releaseError, setReleaseError] = useState<string | null>(null)

  // Off-platform copy (gift / artist copy / test) — consumes a number by
  // hand, no Stripe, no order. Variants + free numbers load when the modal
  // opens so the pickers are always current.
  const [giftOpen, setGiftOpen] = useState(false)
  const [giftVariants, setGiftVariants] = useState<GiftableVariantRow[]>([])
  const [giftVariantId, setGiftVariantId] = useState('')
  const [giftNumber, setGiftNumber] = useState<number | ''>('')
  const [giftKind, setGiftKind] = useState<OffPlatformKind>('gift')
  const [giftRecipient, setGiftRecipient] = useState('')
  // Full shipping address — copied by the admin into the TPS portal when
  // placing the physical order (so it must be complete enough to ship).
  const emptyAddress = {
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    phone: '',
  }
  const [giftAddress, setGiftAddress] = useState(emptyAddress)
  const setAddr = (field: keyof typeof emptyAddress, value: string) =>
    setGiftAddress((a) => ({ ...a, [field]: value }))
  const [giftNote, setGiftNote] = useState('')
  const [giftSaving, setGiftSaving] = useState(false)
  const [giftError, setGiftError] = useState<string | null>(null)

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
    const res = await listEditionSales()
    if (res.ok) setSales(res.sales)
    else setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (sessionStatus === 'authenticated') load()
  }, [sessionStatus, load])

  // Variant-card deep link: /admin/edition-sales?gift=<variantId> opens the
  // modal preselected on that variant (admin clicked "Create gift order" on
  // an artwork's variant panel).
  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !giftParam || giftParamHandled.current) return
    giftParamHandled.current = true
    openGift(giftParam)
    // openGift is stable in behaviour but not in identity — run-once guard
    // (giftParamHandled) makes the dependency irrelevant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, giftParam])

  const handleRelease = async () => {
    if (!releaseTarget) return
    setReleasing(true)
    setReleaseError(null)
    const res = await releaseOrphanedEditionNumber(releaseTarget.id)
    setReleasing(false)
    if (res.ok) {
      setReleaseTarget(null)
      await load()
    } else {
      setReleaseError(res.error)
    }
  }

  const closeRelease = () => {
    if (releasing) return
    setReleaseTarget(null)
    setReleaseError(null)
  }

  const selectedGiftVariant = giftVariants.find((v) => v.variantId === giftVariantId) ?? null

  // The modal is ALWAYS scoped to one variant — the admin clicked "Create
  // gift order" on that variant's card, so the context is already chosen and
  // is displayed read-only (no picker; Eduardo, 2026-07-25).
  const openGift = async (variantId: string) => {
    setGiftError(null)
    setGiftNote('')
    setGiftRecipient('')
    setGiftAddress(emptyAddress)
    setGiftKind('gift')
    setGiftOpen(true)
    const res = await listGiftableVariants()
    if (!res.ok) {
      setGiftVariants([])
      setGiftError(res.error)
      return
    }
    setGiftVariants(res.variants)
    const target = res.variants.find((v) => v.variantId === variantId)
    if (!target) {
      setGiftError(
        'This variant has no available numbers left (or is not published) — nothing to gift.',
      )
      setGiftVariantId('')
      setGiftNumber('')
      return
    }
    setGiftVariantId(target.variantId)
    setGiftNumber(target.availableNumbers[0] ?? '')
  }

  const handleGiftConfirm = async () => {
    if (!giftVariantId || giftNumber === '') {
      setGiftError('Pick a variant and a number.')
      return
    }
    if (!giftRecipient.trim()) {
      setGiftError('A recipient name is required.')
      return
    }
    if (
      !giftAddress.line1.trim() ||
      !giftAddress.city.trim() ||
      !giftAddress.postalCode.trim() ||
      !giftAddress.country.trim()
    ) {
      setGiftError('Street, city, postal code and country are required (they go to TPS).')
      return
    }
    setGiftSaving(true)
    setGiftError(null)
    const res = await createOffPlatformOrder({
      variantId: giftVariantId,
      number: giftNumber,
      kind: giftKind,
      recipientName: giftRecipient,
      address: giftAddress,
      note: giftNote,
    })
    setGiftSaving(false)
    if (res.ok) {
      setGiftOpen(false)
      await load()
    } else {
      setGiftError(res.error)
    }
  }

  const closeGift = () => {
    if (giftSaving) return
    setGiftOpen(false)
    setGiftError(null)
  }

  // ── Render-only derivations ──
  // The first read failed: nothing is known, so the cards show "–" and the
  // list is replaced by the error (a failed re-read keeps the rows it had).
  const loadFailed = !loading && error !== null && sales.length === 0
  const ledgerKnown = !loading && !loadFailed
  const filtersActive = Boolean(artworkFilter || variantFilter || statusFilter)
  const countLabel = filtersActive
    ? `${visibleSales.length} of ${copies(sales.length)}`
    : copies(sales.length)
  const toggleStatus = (status: StatusFilter) =>
    setFilters({
      artwork: artworkFilter,
      variant: variantFilter,
      status: statusFilter === status ? '' : status,
    })
  const clearFilters = () => {
    setFilters({})
    setSort(null)
  }
  const clearButton = (
    <Button
      variant="bare"
      font="dashboard"
      className={styles.clear}
      label="Clear"
      onClick={clearFilters}
    />
  )

  return (
    <div className={styles.page}>
      <AdminPageHeader
        eyebrow="Sales"
        title="Edition sales"
        description="Every numbered copy reserved or sold. Our authoritative ledger, newest first."
      />

      {/* Off-platform copies (gifts, artist copies, test prints) are created
          from the artwork's variant panel — the "Create gift order" button on
          a live variant deep-links here with ?gift=<variantId>, which opens
          the modal below preselected. No standalone entry point on this page
          (Eduardo, 2026-07-25). */}

      <section aria-label="Summary" className={styles.cards}>
        <StatCard
          label="Sold"
          value={ledgerKnown ? counts.sold : null}
          hint="numbered copies"
          pressed={statusFilter === 'sold'}
          onSelect={ledgerKnown ? () => toggleStatus('sold') : undefined}
        />
        <StatCard
          label="Reserved"
          value={ledgerKnown ? counts.reserved : null}
          hint="held at checkout"
          pressed={statusFilter === 'reserved'}
          onSelect={ledgerKnown ? () => toggleStatus('reserved') : undefined}
        />
        <StatCard
          label="Off-platform"
          value={ledgerKnown ? counts.offPlatform : null}
          hint="gifts, artist copies, tests"
          pressed={statusFilter === 'off-platform'}
          onSelect={ledgerKnown ? () => toggleStatus('off-platform') : undefined}
        />
        {/* Not a filter (Q18): no Status option matches it yet. */}
        <StatCard
          label="Not mirrored in TPS"
          value={ledgerKnown ? counts.notMirrored : null}
          tone={ledgerKnown && counts.notMirrored > 0 ? 'amber' : 'plain'}
          hint={
            !ledgerKnown
              ? undefined
              : counts.notMirrored > 0
                ? 'Mark them sold at TPS too'
                : 'All mirrored'
          }
        />
      </section>

      {error && <Callout tone="red">{error}</Callout>}

      {!loadFailed && (
        <ListPanel
          label="Copies"
          toolbar={
            ledgerKnown && sales.length > 0 ? (
              <div className={styles.filters}>
                <AdminSelect
                  label="Filter by artwork"
                  hideLabel
                  minWidth={220}
                  value={artworkFilter}
                  onChange={(value) =>
                    // The variants below belong to the previous artwork, and a
                    // name like "Small 20" may exist on both — carrying the old
                    // selection over would silently show the wrong edition.
                    setFilters({ artwork: value, variant: '', status: statusFilter })
                  }
                >
                  <option value="">All artworks</option>
                  {artworkOptions.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </AdminSelect>

                <AdminSelect
                  label="Filter by variant"
                  hideLabel
                  minWidth={200}
                  value={variantFilter}
                  disabled={!artworkFilter}
                  title={artworkFilter ? undefined : 'Choose an artwork first'}
                  onChange={(value) =>
                    setFilters({ artwork: artworkFilter, variant: value, status: statusFilter })
                  }
                >
                  <option value="">
                    {artworkFilter ? 'All variants' : 'Choose an artwork first'}
                  </option>
                  {variantOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </AdminSelect>

                <AdminSelect
                  label="Filter by status"
                  hideLabel
                  value={statusFilter}
                  onChange={(value) =>
                    setFilters({
                      artwork: artworkFilter,
                      variant: variantFilter,
                      status: isStatusFilter(value) ? value : '',
                    })
                  }
                >
                  <option value="">Any status</option>
                  {STATUS_FILTERS.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_META[status].label}
                    </option>
                  ))}
                </AdminSelect>

                {(filtersActive || sort) && clearButton}
              </div>
            ) : undefined
          }
          count={ledgerKnown && sales.length > 0 ? countLabel : undefined}
          footnote={
            ledgerKnown && visibleSales.length > 0
              ? 'Release frees a reserved number that has no order (an abandoned checkout), putting it back on sale.'
              : undefined
          }
        >
          {loading ? (
            <p className={styles.loading}>Loading…</p>
          ) : sales.length === 0 ? (
            <EmptyState title="No numbered copies yet." />
          ) : visibleSales.length === 0 ? (
            <EmptyState title="No copies match these filters." action={clearButton} />
          ) : (
            <DataTable className={styles.table}>
              <thead>
                <tr>
                  <SortHeader
                    label="Date"
                    lead="Sort by"
                    active={sort?.key === 'date' ? sort.dir : null}
                    onClick={() => setSort(cycleSort(sort, 'date'))}
                  />
                  <th scope="col">Artwork · variant</th>
                  <SortHeader
                    label="Number"
                    lead="·"
                    active={sort?.key === 'number' ? sort.dir : null}
                    onClick={() => setSort(cycleSort(sort, 'number'))}
                  />
                  <th scope="col">Holder</th>
                  <th scope="col">Status</th>
                  <th scope="col">In TPS</th>
                  <th scope="col" className={styles.alignRight}>
                    Order
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleSales.map((s) => {
                  const status = STATUS_META[statusOf(s)]
                  return (
                    <tr key={s.id} className={styles.row}>
                      <td className={styles.cellDate}>{formatDate(s.date)}</td>
                      <td className={styles.cellArtwork}>
                        {s.artworkSlug ? (
                          <Link href={`/artworks/${s.artworkSlug}`} className={styles.artwork}>
                            {s.artworkTitle}
                          </Link>
                        ) : (
                          <span className={styles.artwork}>{s.artworkTitle}</span>
                        )}
                        <div className={styles.sub}>
                          {[s.artistName, s.variantName].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className={styles.cellNumber}>
                        {s.number}/{s.editionSize}
                      </td>
                      <td className={styles.cellHolder}>
                        {s.offPlatformKind ? (
                          <>
                            <div className={styles.kind}>
                              <OffPlatformKindMark kind={s.offPlatformKind} />
                              {OFF_PLATFORM_KIND_LABELS[s.offPlatformKind as OffPlatformKind] ??
                                s.offPlatformKind}
                            </div>
                            {s.offPlatformNote && (
                              <div className={styles.sub}>{s.offPlatformNote}</div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className={styles.holder}>{s.buyerName ?? '—'}</div>
                            {s.buyerEmail && <div className={styles.sub}>{s.buyerEmail}</div>}
                          </>
                        )}
                      </td>
                      <td className={styles.cellStatus}>
                        <StatusPill label={status.label} tone={status.tone} shape="tag" />
                      </td>
                      <td className={c(styles.cellTps, !s.mirroredInTps && styles.cellTpsNone)}>
                        {s.mirroredInTps ? (
                          <span className={styles.mirrored}>
                            Mirrored<span className={styles.phoneOnly}> in TPS</span>
                          </span>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                      <td className={styles.cellOrder}>
                        {/* Orphaned (order-less) rows can be released from here —
                            freed back to available, keeping the numbered slot.
                            Order-bound copies are managed via their order. */}
                        {s.orderId ? (
                          <Link href={`/admin/orders/${s.orderId}`} className={styles.ref}>
                            <span className={styles.phoneOnly}>Order </span>
                            {formatOrderRef(s.orderId)}
                          </Link>
                        ) : s.offPlatformKind ? (
                          // Q16 (b): no Release on gift / artist-copy rows; the server
                          // always refuses them (cancel from Gift orders instead).
                          <span className={styles.muted}>—</span>
                        ) : (
                          <Button
                            variant="bare"
                            font="dashboard"
                            className={styles.release}
                            label="Release"
                            onClick={() => {
                              setReleaseError(null)
                              setReleaseTarget(s)
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </DataTable>
          )}
        </ListPanel>
      )}

      {giftOpen && (
        <AdminConfirmModal
          size="wide"
          icon={null}
          title="Add an off-platform copy"
          message={
            <div className={styles.form}>
              <p className={styles.intro}>
                Consume a numbered copy <strong>without a sale</strong> — a gallery gift, an
                artist-retained copy, or a test print. The number is marked sold in the ledger so it
                can never be sold to a buyer, and the parcel gets its own entry on{' '}
                <strong>Gift orders</strong> with the usual fulfillment stages. Remember to also
                tick the number in The Print Space&apos;s editions panel.
              </p>

              {giftVariants.length === 0 && !giftError ? (
                <p className={styles.formLoading}>Loading…</p>
              ) : !selectedGiftVariant ? null : (
                <>
                  {/* The variant is fixed — chosen by the button the admin
                      clicked. Read-only context, not a picker. */}
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Artwork · variant</span>
                    <p className={styles.fixedVariant}>
                      {selectedGiftVariant.artworkTitle} ({selectedGiftVariant.artistName}) —{' '}
                      {selectedGiftVariant.variantName} ·{' '}
                      {selectedGiftVariant.availableNumbers.length} of{' '}
                      {selectedGiftVariant.editionSize} free
                    </p>
                  </div>

                  {/* The two pickers stay unnamed controls: the Kind trigger's
                      name is the kind it shows ("Gallery gift"). The group
                      gives each its caption. */}
                  <div className={styles.pair}>
                    <div className={styles.field} role="group" aria-labelledby="gift-number-label">
                      <span id="gift-number-label" className={styles.fieldLabel}>
                        Number
                      </span>
                      <SelectDropdown<string>
                        className={styles.dropdown}
                        options={(selectedGiftVariant?.availableNumbers ?? []).map((n) => ({
                          value: String(n),
                          label: `${n}/${selectedGiftVariant?.editionSize}`,
                        }))}
                        value={giftNumber === '' ? '' : String(giftNumber)}
                        onChange={(v) => setGiftNumber(Number(v))}
                      />
                    </div>

                    <div className={styles.field} role="group" aria-labelledby="gift-kind-label">
                      <span id="gift-kind-label" className={styles.fieldLabel}>
                        Kind
                      </span>
                      <SelectDropdown<OffPlatformKind>
                        className={styles.dropdown}
                        options={OFF_PLATFORM_KINDS.map((k) => ({
                          value: k,
                          label: OFF_PLATFORM_KIND_LABELS[k],
                          badge: <OffPlatformKindMark kind={k} />,
                        }))}
                        value={giftKind}
                        onChange={(v) => setGiftKind(v)}
                      />
                    </div>
                  </div>

                  {/* Kind decides the artist fee: gifts owe the artist's cut
                      (snapshotted now); artist copies / tests owe nothing. */}
                  {giftKind === 'gift' ? (
                    <p className={styles.fee}>
                      Artist fee owed:{' '}
                      <strong>
                        €{((selectedGiftVariant.artistPriceCents ?? 0) / 100).toFixed(2)}
                      </strong>{' '}
                      — a gift still pays the artist their cut (no gallery cut).
                    </p>
                  ) : (
                    <p className={styles.fee}>
                      No artist fee — artist copies and test prints owe nothing.
                    </p>
                  )}

                  <div className={styles.field}>
                    <label htmlFor="gift-recipient" className={styles.fieldLabel}>
                      Recipient
                    </label>
                    <Input
                      id="gift-recipient"
                      type="text"
                      size="bare"
                      inputClassName={styles.input}
                      value={giftRecipient}
                      onChange={(e) => setGiftRecipient(e.target.value)}
                      placeholder="Who receives this print (e.g. Mathias Heizmann)"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="gift-line1" className={styles.fieldLabel}>
                      Street address
                    </label>
                    <Input
                      id="gift-line1"
                      type="text"
                      size="bare"
                      inputClassName={styles.input}
                      value={giftAddress.line1}
                      onChange={(e) => setAddr('line1', e.target.value)}
                      placeholder="Street and number"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="gift-line2" className={styles.fieldLabel}>
                      Address line 2 (optional)
                    </label>
                    <Input
                      id="gift-line2"
                      type="text"
                      size="bare"
                      inputClassName={styles.input}
                      value={giftAddress.line2}
                      onChange={(e) => setAddr('line2', e.target.value)}
                      placeholder="Apartment, floor, c/o…"
                    />
                  </div>

                  <div className={c(styles.pair, styles.pairPostal)}>
                    <div className={styles.field}>
                      <label htmlFor="gift-city" className={styles.fieldLabel}>
                        City
                      </label>
                      <Input
                        id="gift-city"
                        type="text"
                        size="bare"
                        inputClassName={styles.input}
                        value={giftAddress.city}
                        onChange={(e) => setAddr('city', e.target.value)}
                        placeholder="City"
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="gift-postal" className={styles.fieldLabel}>
                        Postal code
                      </label>
                      <Input
                        id="gift-postal"
                        type="text"
                        size="bare"
                        inputClassName={styles.input}
                        value={giftAddress.postalCode}
                        onChange={(e) => setAddr('postalCode', e.target.value)}
                        placeholder="e.g. 28220"
                      />
                    </div>
                  </div>

                  <div className={styles.pair}>
                    <div className={styles.field}>
                      <label htmlFor="gift-state" className={styles.fieldLabel}>
                        Region / state (optional)
                      </label>
                      <Input
                        id="gift-state"
                        type="text"
                        size="bare"
                        inputClassName={styles.input}
                        value={giftAddress.state}
                        onChange={(e) => setAddr('state', e.target.value)}
                        placeholder="e.g. Bayern"
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="gift-country" className={styles.fieldLabel}>
                        Country
                      </label>
                      <Input
                        id="gift-country"
                        type="text"
                        size="bare"
                        inputClassName={styles.input}
                        value={giftAddress.country}
                        onChange={(e) => setAddr('country', e.target.value)}
                        placeholder="e.g. Germany"
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="gift-phone" className={styles.fieldLabel}>
                      Phone (optional, for the courier)
                    </label>
                    <Input
                      id="gift-phone"
                      type="text"
                      size="bare"
                      inputClassName={styles.input}
                      value={giftAddress.phone}
                      onChange={(e) => setAddr('phone', e.target.value)}
                      placeholder="+49…"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="gift-note" className={styles.fieldLabel}>
                      Note
                    </label>
                    <textarea
                      id="gift-note"
                      className={c(styles.input, styles.textarea)}
                      value={giftNote}
                      onChange={(e) => setGiftNote(e.target.value)}
                      rows={2}
                      placeholder="Reason / TPS order ref (e.g. test print, TPS WB-AA12345)"
                    />
                  </div>
                </>
              )}
            </div>
          }
          warning={giftError}
          confirmLabel="Mark number as taken"
          cancelLabel="Cancel"
          busy={giftSaving || (giftVariants.length === 0 && !giftError)}
          onConfirm={handleGiftConfirm}
          onCancel={closeGift}
        />
      )}

      {releaseTarget && (
        <AdminConfirmModal
          title="Release this number?"
          message={
            <>
              This frees copy{' '}
              <strong>
                {releaseTarget.number}/{releaseTarget.editionSize}
              </strong>{' '}
              of <strong>{releaseTarget.artworkTitle}</strong> ({releaseTarget.variantName}) back to{' '}
              <strong>available</strong> — it leaves this ledger and can be sold again. The numbered
              slot stays in place, so the edition isn&apos;t gapped.
            </>
          }
          warning={
            releaseError ? (
              releaseError
            ) : releaseTarget.state === 'sold' ? (
              <>
                This copy is marked <strong>sold</strong> — only release it if the print was never
                produced.
              </>
            ) : null
          }
          confirmLabel="Yes, release it"
          cancelLabel="Keep it"
          busy={releasing}
          onConfirm={handleRelease}
          onCancel={closeRelease}
        />
      )}
    </div>
  )
}
